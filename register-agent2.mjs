import { finalizeEvent, getPublicKey, nip19 } from 'nostr-tools';
import { Relay } from 'nostr-tools/relay';

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band'];
const SITE_KIND = 30078;
const BID_KIND = 30079;

// Test Agent 2 keys
const privKeyHex = '4e72d4a0ca6b10dac4b6adaf57e0c67715019988c2e3034b131e343bef9f8a2b';
const privKey = new Uint8Array(privKeyHex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
const pubkey = getPublicKey(privKey);

console.log('Agent 2:', nip19.npubEncode(pubkey));

// Register a test site from Agent 2
const site = {
  name: 'OC Pro Painters',
  url: 'https://ocpropainters.com',
  city: 'Irvine',
  state: 'CA',
  industry: 'painting',
  da: 22
};

const siteEvent = finalizeEvent({
  kind: SITE_KIND,
  created_at: Math.floor(Date.now() / 1000),
  tags: [['d', site.url], ['t', 'abn-site'], ['t', site.industry], ['L', 'abn'], ['l', 'site-registration', 'abn']],
  content: JSON.stringify({ ...site, registeredAt: new Date().toISOString() })
}, privKey);

// Also post a bid seeking links
const bid = {
  type: 'seeking',
  targetSite: 'https://ocpropainters.com',
  industry: 'painting',
  requirements: { minDA: 10, industries: ['painting', 'construction', 'home-improvement'], states: ['CA'], linkType: 'dofollow' },
  offer: { sats: 2500, paymentTerms: 'on-verification' }
};

const bidEvent = finalizeEvent({
  kind: BID_KIND,
  created_at: Math.floor(Date.now() / 1000),
  tags: [
    ['d', 'bid-' + Date.now()],
    ['t', 'abn-bid'],
    ['t', 'seeking'],
    ['t', 'painting'],
    ['L', 'abn'],
    ['l', 'link-bid', 'abn'],
    ['amount', '2500'],
    ['expiry', String(Math.floor(Date.now() / 1000) + 86400 * 7)]
  ],
  content: JSON.stringify(bid)
}, privKey);

for (const url of RELAYS) {
  try {
    const relay = await Relay.connect(url);
    await relay.publish(siteEvent);
    await relay.publish(bidEvent);
    relay.close();
    console.log('✓', url);
  } catch (e) { console.log('✗', url); }
}

console.log('\n✅ Agent 2 registered site + posted bid for 2500 sats!');
