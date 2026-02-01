// GET /api/match - Find compatible link exchange partners
// Matches based on: same industry, same state, complementary services

import { SimplePool } from 'nostr-tools/pool';

const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
  'wss://relay.snort.social'
];

const ABN_SITE_KIND = 30078;

// Industry compatibility matrix
const COMPATIBLE_INDUSTRIES = {
  'plumbing': ['hvac', 'electrical', 'construction', 'roofing', 'home-services'],
  'hvac': ['plumbing', 'electrical', 'construction', 'roofing', 'home-services'],
  'electrical': ['plumbing', 'hvac', 'construction', 'solar', 'home-services'],
  'roofing': ['construction', 'gutters', 'siding', 'painting', 'home-services'],
  'painting': ['roofing', 'construction', 'flooring', 'home-services'],
  'landscaping': ['tree-service', 'lawn-care', 'hardscape', 'outdoor-living'],
  'tree-service': ['landscaping', 'lawn-care', 'arborist'],
  'construction': ['roofing', 'plumbing', 'electrical', 'hvac', 'concrete'],
  'real-estate': ['mortgage', 'home-inspection', 'title', 'moving'],
  'legal': ['accounting', 'financial', 'insurance', 'real-estate'],
  'restaurant': ['catering', 'food-delivery', 'event-venue'],
  'default': [] // No automatic matches for unknown industries
};

function getCompatibleIndustries(industry) {
  const normalized = industry?.toLowerCase().replace(/\s+/g, '-') || 'default';
  return COMPATIBLE_INDUSTRIES[normalized] || COMPATIBLE_INDUSTRIES['default'];
}

function calculateMatchScore(site, candidate) {
  let score = 0;
  const reasons = [];

  // Same state = +30 points
  if (site.state && candidate.state && 
      site.state.toLowerCase() === candidate.state.toLowerCase()) {
    score += 30;
    reasons.push('same-state');
  }

  // Same city = +20 bonus
  if (site.city && candidate.city &&
      site.city.toLowerCase() === candidate.city.toLowerCase()) {
    score += 20;
    reasons.push('same-city');
  }

  // Same industry = +25 (good for niche relevance)
  if (site.industry && candidate.industry &&
      site.industry.toLowerCase() === candidate.industry.toLowerCase()) {
    score += 25;
    reasons.push('same-industry');
  }

  // Compatible industry = +20
  const compatible = getCompatibleIndustries(site.industry);
  if (candidate.industry && compatible.includes(candidate.industry.toLowerCase())) {
    score += 20;
    reasons.push('compatible-industry');
  }

  // Different owner = required (can't exchange with yourself)
  if (site.pubkey === candidate.pubkey) {
    return { score: 0, reasons: ['same-owner'] };
  }

  // Base score for being on the network
  score += 10;
  reasons.push('on-network');

  return { score, reasons };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { url, pubkey, industry, state, limit = 20 } = req.query;

    if (!url && !pubkey) {
      return res.status(400).json({
        error: 'Missing required parameter',
        required: 'url or pubkey to find matches for'
      });
    }

    const pool = new SimplePool();
    
    // Get all sites
    const events = await pool.querySync(RELAYS, {
      kinds: [ABN_SITE_KIND],
      '#t': ['abn-site'],
      limit: 500
    });
    pool.close(RELAYS);

    // Parse into sites
    const sites = [];
    const seenUrls = new Set();

    for (const event of events) {
      try {
        const content = JSON.parse(event.content);
        if (content.type !== 'site-registration') continue;
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
          canOffer: content.canOffer
        });
      } catch (e) {}
    }

    // Find the source site
    let sourceSite = sites.find(s => s.url === url || s.pubkey === pubkey);
    
    // If not found, create a virtual site from query params
    if (!sourceSite) {
      sourceSite = { url, pubkey, industry, state };
    }

    // Calculate match scores
    const matches = sites
      .filter(s => s.url !== sourceSite.url)
      .map(candidate => ({
        ...candidate,
        match: calculateMatchScore(sourceSite, candidate)
      }))
      .filter(m => m.match.score > 0)
      .sort((a, b) => b.match.score - a.match.score)
      .slice(0, parseInt(limit));

    return res.status(200).json({
      source: sourceSite,
      matchCount: matches.length,
      matches: matches.map(m => ({
        name: m.name,
        url: m.url,
        city: m.city,
        state: m.state,
        industry: m.industry,
        pubkey: m.pubkey,
        score: m.match.score,
        reasons: m.match.reasons
      }))
    });

  } catch (err) {
    console.error('Match error:', err);
    return res.status(500).json({ error: err.message });
  }
}
