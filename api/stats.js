// GET /api/stats - Network statistics

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
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');

  try {
    const pool = new SimplePool();
    
    const events = await pool.querySync(RELAYS, {
      kinds: [ABN_SITE_KIND],
      '#t': ['abn-site'],
      limit: 1000
    });
    pool.close(RELAYS);

    const sites = new Map();
    const agents = new Set();
    const industries = {};
    const states = {};

    for (const event of events) {
      try {
        const content = JSON.parse(event.content);
        if (content.type !== 'site-registration') continue;
        
        // Dedupe by URL
        if (!sites.has(content.url)) {
          sites.set(content.url, content);
          agents.add(event.pubkey);
          
          // Count industries
          const ind = content.industry || 'other';
          industries[ind] = (industries[ind] || 0) + 1;
          
          // Count states
          const st = content.state || 'unknown';
          states[st] = (states[st] || 0) + 1;
        }
      } catch (e) {}
    }

    // Sort by count
    const topIndustries = Object.entries(industries)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    const topStates = Object.entries(states)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return res.status(200).json({
      network: 'Agent Backlink Network',
      protocol: 'Nostr',
      totalSites: sites.size,
      totalAgents: agents.size,
      relayCount: RELAYS.length,
      topIndustries,
      topStates,
      lastUpdated: new Date().toISOString()
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
