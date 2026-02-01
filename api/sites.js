// GET /api/sites - List all registered sites on the network
// Queries Nostr relays for ABN site events

import { SimplePool } from 'nostr-tools/pool';

const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
  'wss://relay.snort.social'
];

const ABN_SITE_KIND = 30078;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { industry, state, type, limit = 100 } = req.query;
    
    const pool = new SimplePool();
    
    // Build filter
    const filter = {
      kinds: [ABN_SITE_KIND],
      '#t': ['abn-site'],
      limit: parseInt(limit)
    };

    // Add optional filters
    if (industry) filter['#t'].push(industry.toLowerCase());
    if (type) filter['#t'].push(type.toLowerCase());

    const events = await pool.querySync(RELAYS, filter);
    pool.close(RELAYS);

    // Parse events into sites
    const sites = [];
    const seenUrls = new Set();

    for (const event of events) {
      try {
        const content = JSON.parse(event.content);
        if (content.type !== 'site-registration') continue;
        
        // Filter by state if specified
        if (state && content.state?.toLowerCase() !== state.toLowerCase()) continue;
        
        // Dedupe by URL (keep newest)
        if (seenUrls.has(content.url)) continue;
        seenUrls.add(content.url);

        sites.push({
          id: event.id,
          pubkey: event.pubkey,
          name: content.name,
          url: content.url,
          city: content.city,
          state: content.state,
          industry: content.industry,
          type: content.businessType,
          da: content.da,
          wantLinks: content.wantLinks,
          canOffer: content.canOffer,
          registeredAt: content.registeredAt || new Date(event.created_at * 1000).toISOString()
        });
      } catch (e) {
        // Skip malformed events
      }
    }

    // Sort by most recent
    sites.sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));

    return res.status(200).json({
      count: sites.length,
      filters: { industry, state, type },
      sites
    });

  } catch (err) {
    console.error('Sites query error:', err);
    return res.status(500).json({ error: err.message });
  }
}
