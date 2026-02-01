// POST /api/register - Register a site to the network
// Publishes to Nostr relays (decentralized, no central DB)

import { finalizeEvent, getPublicKey, nip19 } from 'nostr-tools';
import { Relay } from 'nostr-tools/relay';

const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
  'wss://relay.snort.social'
];

const ABN_SITE_KIND = 30078; // Application-specific parameterized replaceable

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { privateKey, site } = req.body;
    
    if (!privateKey || !site) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['privateKey (hex or nsec)', 'site (object with name, url, type, city, state, industry)']
      });
    }

    // Decode private key if nsec format
    let privKeyHex = privateKey;
    if (privateKey.startsWith('nsec')) {
      const decoded = nip19.decode(privateKey);
      privKeyHex = Buffer.from(decoded.data).toString('hex');
    }

    // Convert hex to Uint8Array
    const privKeyBytes = new Uint8Array(
      privKeyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
    );

    const pubkey = getPublicKey(privKeyBytes);

    // Create the Nostr event
    const event = finalizeEvent({
      kind: ABN_SITE_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', site.url], // Unique identifier for replaceable event
        ['t', 'abn-site'],
        ['t', site.type || 'business'],
        ['t', site.industry || 'general'],
        ['L', 'abn'],
        ['l', 'site-registration', 'abn']
      ],
      content: JSON.stringify({
        type: 'site-registration',
        name: site.name,
        url: site.url,
        city: site.city || '',
        state: site.state || '',
        industry: site.industry || '',
        businessType: site.type || 'business',
        wantLinks: site.wantLinks || ['homepage'],
        canOffer: site.canOffer || ['footer'],
        da: site.da || null,
        registeredAt: new Date().toISOString()
      })
    }, privKeyBytes);

    // Publish to relays
    const results = [];
    for (const url of RELAYS) {
      try {
        const relay = await Relay.connect(url);
        await relay.publish(event);
        results.push({ relay: url, status: 'published' });
        relay.close();
      } catch (err) {
        results.push({ relay: url, status: 'failed', error: err.message });
      }
    }

    const npub = nip19.npubEncode(pubkey);
    
    return res.status(200).json({
      success: true,
      eventId: event.id,
      pubkey,
      npub,
      site: site.name,
      url: site.url,
      relays: results
    });

  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: err.message });
  }
}
