/**
 * Local State Management
 * Stores agent identity and exchange history locally in JSON
 */

import fs from 'fs';
import path from 'path';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import type { LocalState, SiteRegistration, ExchangeProposal } from '../types/index.js';
import { DEFAULT_RELAYS } from './nostr.js';

const STATE_DIR = path.join(process.env.HOME || '.', '.abn');
const STATE_FILE = path.join(STATE_DIR, 'state.json');

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Load or create local state
 */
export function loadState(): LocalState {
  ensureStateDir();

  if (fs.existsSync(STATE_FILE)) {
    const data = fs.readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(data);
  }

  // Create new identity
  const privateKey = generateSecretKey();
  const publicKey = getPublicKey(privateKey);

  const state: LocalState = {
    privateKey: bytesToHex(privateKey),
    publicKey,
    npub: nip19.npubEncode(publicKey),
    sites: [],
    pendingProposals: [],
    completedExchanges: [],
    relays: DEFAULT_RELAYS,
  };

  saveState(state);
  return state;
}

/**
 * Save state to disk
 */
export function saveState(state: LocalState): void {
  ensureStateDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Ensure state directory exists
 */
function ensureStateDir(): void {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

/**
 * Add a site to local state
 */
export function addSite(site: SiteRegistration): LocalState {
  const state = loadState();
  
  // Check if site already exists
  const existing = state.sites.findIndex(s => s.url === site.url);
  if (existing >= 0) {
    state.sites[existing] = site; // Update
  } else {
    state.sites.push(site);
  }
  
  saveState(state);
  return state;
}

/**
 * Get sites from local state
 */
export function getSites(): SiteRegistration[] {
  const state = loadState();
  return state.sites;
}

/**
 * Add incoming proposal
 */
export function addIncomingProposal(
  proposal: ExchangeProposal,
  fromPubkey: string
): LocalState {
  const state = loadState();
  
  // Check if already exists
  if (state.pendingProposals.find(p => p.id === proposal.proposalId)) {
    return state;
  }

  state.pendingProposals.push({
    id: proposal.proposalId,
    direction: 'incoming',
    proposal,
    fromPubkey,
    toPubkey: state.publicKey,
    status: 'pending',
    createdAt: Date.now(),
  });
  
  saveState(state);
  return state;
}

/**
 * Add outgoing proposal
 */
export function addOutgoingProposal(
  proposal: ExchangeProposal,
  toPubkey: string
): LocalState {
  const state = loadState();
  
  state.pendingProposals.push({
    id: proposal.proposalId,
    direction: 'outgoing',
    proposal,
    fromPubkey: state.publicKey,
    toPubkey,
    status: 'pending',
    createdAt: Date.now(),
  });
  
  saveState(state);
  return state;
}

/**
 * Update proposal status
 */
export function updateProposalStatus(
  proposalId: string,
  status: 'pending' | 'accepted' | 'rejected' | 'completed'
): LocalState {
  const state = loadState();
  
  const proposal = state.pendingProposals.find(p => p.id === proposalId);
  if (proposal) {
    proposal.status = status;
    if (status === 'completed') {
      state.completedExchanges.push(proposalId);
    }
  }
  
  saveState(state);
  return state;
}

/**
 * Get pending proposals
 */
export function getPendingProposals(direction?: 'incoming' | 'outgoing') {
  const state = loadState();
  return state.pendingProposals.filter(p => {
    if (direction && p.direction !== direction) return false;
    return p.status === 'pending';
  });
}

/**
 * Get state file path (for display)
 */
export function getStatePath(): string {
  return STATE_FILE;
}

/**
 * Export identity for backup
 */
export function exportIdentity(): { nsec: string; npub: string; publicKey: string } {
  const state = loadState();
  
  function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  return {
    nsec: nip19.nsecEncode(hexToBytes(state.privateKey)),
    npub: state.npub,
    publicKey: state.publicKey,
  };
}

/**
 * Import identity from nsec
 */
export function importIdentity(nsec: string): LocalState {
  const decoded = nip19.decode(nsec);
  if (decoded.type !== 'nsec') {
    throw new Error('Invalid nsec format');
  }

  const privateKey = decoded.data as Uint8Array;
  const publicKey = getPublicKey(privateKey);

  const state = loadState();
  state.privateKey = bytesToHex(privateKey);
  state.publicKey = publicKey;
  state.npub = nip19.npubEncode(publicKey);
  
  saveState(state);
  return state;
}
