import { finalizeEvent, getPublicKey, nip19 } from 'nostr-tools';
import { Relay } from 'nostr-tools/relay';

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band'];
const SITE_KIND = 30078;

const privKeyHex = '33723d3608b8f5cdcdfb6ca982a9084f17a50a9371901775a2c9409b9065de1c';
const privKey = new Uint8Array(privKeyHex.match(/.{1,2}/g).map(b => parseInt(b, 16)));

const sites = [
  { name: 'Wrangler Painting', url: 'https://wranglerpainting.com', city: 'San Clemente', state: 'CA', industry: 'painting', da: 15 },
  { name: 'TwentyOne Solutions', url: 'https://twentyonesolutions.com', city: 'San Clemente', state: 'CA', industry: 'marketing', da: 20 },
  { name: 'Huff Painting', url: 'https://huffpainting.co', city: 'San Clemente', state: 'CA', industry: 'painting', da: 10 },
  { name: 'Dr. J Kennedy', url: 'https://drjkennedy.com', city: 'Newport Beach', state: 'CA', industry: 'healthcare', da: 25 },
  { name: 'SNJ Automotive', url: 'https://snjautomotive.com', city: 'Orange County', state: 'CA', industry: 'automotive', da: 18 }
];

for (const site of sites) {
  const event = finalizeEvent({
    kind: SITE_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['d', site.url], ['t', 'abn-site'], ['t', site.industry], ['L', 'abn'], ['l', 'site-registration', 'abn']],
    content: JSON.stringify({ ...site, registeredAt: new Date().toISOString() })
  }, privKey);

  for (const url of RELAYS) {
    try {
      const relay = await Relay.connect(url);
      await relay.publish(event);
      relay.close();
    } catch (e) {}
  }
  console.log('✓', site.name);
}
console.log('\nDone!');
