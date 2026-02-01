/**
 * Nostr Protocol Layer for Agent Backlink Network
 */

import {
  generateSecretKey,
  getPublicKey,
  nip04,
  nip19,
  finalizeEvent,
  verifyEvent,
  SimplePool,
  type Event,
  type Filter,
} from 'nostr-tools';
import { EVENT_KINDS, type SiteRegistration, type ExchangeProposal, type ExchangeAccept, type ExchangeReject, type ExchangeComplete } from '../types/index.js';

// Default relays to connect to
export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
  'wss://relay.snort.social',
];

export class NostrClient {
  private pool: SimplePool;
  private privateKey: Uint8Array;
  private publicKey: string;
  private relays: string[];

  constructor(privateKeyHex?: string, relays: string[] = DEFAULT_RELAYS) {
    this.pool = new SimplePool();
    this.relays = relays;

    if (privateKeyHex) {
      this.privateKey = hexToBytes(privateKeyHex);
    } else {
      this.privateKey = generateSecretKey();
    }
    this.publicKey = getPublicKey(this.privateKey);
  }

  get pubkey(): string {
    return this.publicKey;
  }

  get npub(): string {
    return nip19.npubEncode(this.publicKey);
  }

  get nsec(): string {
    return nip19.nsecEncode(this.privateKey);
  }

  get privateKeyHex(): string {
    return bytesToHex(this.privateKey);
  }

  /**
   * Register a site on Nostr (kind 30100)
   * Uses parameterized replaceable events so you can update registrations
   */
  async registerSite(site: SiteRegistration): Promise<Event> {
    const event = finalizeEvent({
      kind: EVENT_KINDS.SITE_REGISTRATION,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', site.url], // Identifier for replaceable event
        ['url', site.url],
        ['name', site.businessName],
        ['type', site.businessType],
        ['city', site.location.city],
        ['state', site.location.state],
        ['country', site.location.country],
        ['radius', site.location.radiusMiles.toString()],
        ...site.linkPages.map(p => ['linkpage', p]),
        ...site.lookingFor.map(t => ['lookingfor', t]),
        ...(site.domainAuthority ? [['da', site.domainAuthority.toString()]] : []),
      ],
      content: JSON.stringify(site),
    }, this.privateKey);

    await this.publish(event);
    return event;
  }

  /**
   * Find registered sites matching criteria
   */
  async findSites(options: {
    businessTypes?: string[];
    state?: string;
    lookingFor?: string[];
    excludePubkeys?: string[];
  } = {}): Promise<Event[]> {
    const filter: Filter = {
      kinds: [EVENT_KINDS.SITE_REGISTRATION],
      limit: 100,
    };

    // Nostr doesn't support complex filters, so we fetch all and filter locally
    const events = await this.pool.querySync(this.relays, filter);
    
    return events.filter(event => {
      // Exclude our own sites
      if (event.pubkey === this.publicKey) return false;
      
      // Exclude specific pubkeys
      if (options.excludePubkeys?.includes(event.pubkey)) return false;

      const tags = new Map(event.tags.map(t => [t[0], t.slice(1)]));
      const type = tags.get('type')?.[0];
      const state = tags.get('state')?.[0];
      const lookingFor = event.tags.filter(t => t[0] === 'lookingfor').map(t => t[1]);

      // Filter by business type
      if (options.businessTypes?.length && type && !options.businessTypes.includes(type)) {
        return false;
      }

      // Filter by state
      if (options.state && state !== options.state) {
        return false;
      }

      // Filter by what they're looking for (must include something we offer)
      if (options.lookingFor?.length) {
        const hasMatch = options.lookingFor.some(t => lookingFor.includes(t));
        if (!hasMatch) return false;
      }

      return true;
    });
  }

  /**
   * Get sites by pubkey
   */
  async getSitesByPubkey(pubkey: string): Promise<Event[]> {
    const filter: Filter = {
      kinds: [EVENT_KINDS.SITE_REGISTRATION],
      authors: [pubkey],
    };
    return this.pool.querySync(this.relays, filter);
  }

  /**
   * Send encrypted DM (NIP-04) for exchange proposals
   */
  async sendDM(toPubkey: string, message: ExchangeProposal | ExchangeAccept | ExchangeReject): Promise<Event> {
    const encrypted = await nip04.encrypt(this.privateKey, toPubkey, JSON.stringify(message));
    
    const event = finalizeEvent({
      kind: EVENT_KINDS.ENCRYPTED_DM,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', toPubkey]],
      content: encrypted,
    }, this.privateKey);

    await this.publish(event);
    return event;
  }

  /**
   * Get and decrypt DMs
   */
  async getDMs(since?: number): Promise<{ from: string; message: any; event: Event }[]> {
    const filter: Filter = {
      kinds: [EVENT_KINDS.ENCRYPTED_DM],
      '#p': [this.publicKey],
      ...(since ? { since } : {}),
    };

    const events = await this.pool.querySync(this.relays, filter);
    const decrypted: { from: string; message: any; event: Event }[] = [];

    for (const event of events) {
      try {
        const content = await nip04.decrypt(this.privateKey, event.pubkey, event.content);
        const message = JSON.parse(content);
        decrypted.push({ from: event.pubkey, message, event });
      } catch (e) {
        // Skip messages we can't decrypt (might be for different keys)
      }
    }

    return decrypted;
  }

  /**
   * Publish exchange completion (public record)
   */
  async publishExchangeComplete(exchange: ExchangeComplete): Promise<Event> {
    const event = finalizeEvent({
      kind: EVENT_KINDS.EXCHANGE_COMPLETE,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', exchange.proposalId],
        ['siteA', exchange.siteA.url],
        ['siteB', exchange.siteB.url],
        ['linkA', exchange.siteA.linkUrl],
        ['linkB', exchange.siteB.linkUrl],
        ['verified', exchange.verified.toString()],
      ],
      content: JSON.stringify(exchange),
    }, this.privateKey);

    await this.publish(event);
    return event;
  }

  /**
   * Get completed exchanges for reputation
   */
  async getCompletedExchanges(pubkey?: string): Promise<Event[]> {
    const filter: Filter = {
      kinds: [EVENT_KINDS.EXCHANGE_COMPLETE],
      ...(pubkey ? { authors: [pubkey] } : {}),
    };
    return this.pool.querySync(this.relays, filter);
  }

  /**
   * Subscribe to new events
   */
  subscribe(filter: Filter, onEvent: (event: Event) => void): () => void {
    const sub = this.pool.subscribeMany(this.relays, [filter], {
      onevent: onEvent,
    });
    return () => sub.close();
  }

  /**
   * Publish event to relays
   */
  async publish(event: Event): Promise<void> {
    await Promise.any(this.pool.publish(this.relays, event));
  }

  /**
   * Close all connections
   */
  close(): void {
    this.pool.close(this.relays);
  }
}

// Utility functions
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Parse site registration event into SiteRegistration object
 * Returns null if event is not a valid ABN site registration
 */
export function parseSiteEvent(event: Event): (SiteRegistration & { pubkey: string; eventId: string }) | null {
  try {
    const content = JSON.parse(event.content) as SiteRegistration;
    // Validate it's an ABN site (has required fields)
    if (!content.url || !content.businessName || !content.businessType) {
      return null;
    }
    return {
      ...content,
      pubkey: event.pubkey,
      eventId: event.id,
    };
  } catch {
    // Not valid JSON or not an ABN event
    return null;
  }
}
