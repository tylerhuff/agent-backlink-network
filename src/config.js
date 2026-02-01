// ABN Protocol Configuration
// Edit this file with your own keys and settings

export const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol', 
  'wss://relay.nostr.band',
  'wss://nostr.wine',
  'wss://relay.snort.social'
];

// Event kinds for ABN protocol
export const KINDS = {
  SITE_REGISTRATION: 30078,
  LINK_BID: 30079,
  ENCRYPTED_DM: 4
};

// Load your private key from environment or secrets file
// NEVER hardcode your nsec here
export function loadPrivateKey() {
  // Option 1: Environment variable
  if (process.env.NOSTR_PRIVATE_KEY) {
    return process.env.NOSTR_PRIVATE_KEY;
  }
  
  // Option 2: Read from local secrets file
  // const secrets = JSON.parse(fs.readFileSync('.secrets/nostr.json'));
  // return secrets.nsec;
  
  throw new Error('No private key found. Set NOSTR_PRIVATE_KEY env var or configure secrets file.');
}

// Related industries for matching
export const RELATED_INDUSTRIES = {
  plumbing: ['hvac', 'electrical', 'construction', 'roofing', 'home-services'],
  hvac: ['plumbing', 'electrical', 'construction', 'home-services'],
  roofing: ['construction', 'plumbing', 'gutters', 'siding'],
  electrical: ['plumbing', 'hvac', 'construction', 'solar'],
  construction: ['roofing', 'plumbing', 'hvac', 'electrical', 'concrete'],
  landscaping: ['tree-service', 'lawn-care', 'irrigation', 'hardscaping'],
  'real-estate': ['mortgage', 'home-inspection', 'title', 'moving'],
  dental: ['orthodontics', 'oral-surgery', 'healthcare'],
  legal: ['accounting', 'financial', 'insurance'],
  restaurant: ['catering', 'food-service', 'hospitality']
};

export function isRelatedIndustry(a, b) {
  return RELATED_INDUSTRIES[a]?.includes(b) || RELATED_INDUSTRIES[b]?.includes(a);
}
