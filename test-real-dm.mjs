import { SimplePool } from 'nostr-tools/pool';
import { nip19, nip04, finalizeEvent, getPublicKey } from 'nostr-tools';
import { Relay } from 'nostr-tools/relay';

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band'];

// Ripper's keys
const ripper = {
  privHex: '33723d3608b8f5cdcdfb6ca982a9084f17a50a9371901775a2c9409b9065de1c',
  get privKey() { return new Uint8Array(this.privHex.match(/.{1,2}/g).map(b => parseInt(b, 16))); },
  get pubkey() { return getPublicKey(this.privKey); },
  get npub() { return nip19.npubEncode(this.pubkey); }
};

// Agent 2 keys  
const agent2 = {
  privHex: '4e72d4a0ca6b10dac4b6adaf57e0c67715019988c2e3034b131e343bef9f8a2b',
  get privKey() { return new Uint8Array(this.privHex.match(/.{1,2}/g).map(b => parseInt(b, 16))); },
  get pubkey() { return getPublicKey(this.privKey); },
  get npub() { return nip19.npubEncode(this.pubkey); }
};

console.log('=== REAL DM TEST ===\n');
console.log('Ripper npub:', ripper.npub);
console.log('Agent2 npub:', agent2.npub);

// 1. Agent 2 sends a REAL DM to Ripper
console.log('\n📤 Agent 2 sending REAL DM to Ripper...');

const message = {
  type: 'abn-inquiry',
  message: 'Hey Ripper! I run OC Pro Painters. Saw your Wrangler Painting listing on ABN. Want to exchange links? I can put you on my partners page for 2500 sats.',
  site: 'https://ocpropainters.com',
  offer: 2500
};

const encrypted = await nip04.encrypt(agent2.privKey, ripper.pubkey, JSON.stringify(message));

const dmEvent = finalizeEvent({
  kind: 4, // NIP-04 encrypted DM
  created_at: Math.floor(Date.now() / 1000),
  tags: [['p', ripper.pubkey]], // recipient
  content: encrypted
}, agent2.privKey);

console.log('   Event ID:', dmEvent.id);

// Publish to relays
for (const url of RELAYS) {
  try {
    const relay = await Relay.connect(url);
    await relay.publish(dmEvent);
    console.log('   ✓ Published to', url);
    relay.close();
  } catch (e) {
    console.log('   ✗', url, e.message);
  }
}

// 2. Ripper reads their DMs
console.log('\n📥 Ripper checking DMs...');

const pool = new SimplePool();
const dms = await pool.querySync(RELAYS, {
  kinds: [4],
  '#p': [ripper.pubkey], // DMs sent TO Ripper
  limit: 5
});

console.log(`   Found ${dms.length} DMs to Ripper:\n`);

for (const dm of dms) {
  try {
    const decrypted = await nip04.decrypt(ripper.privKey, dm.pubkey, dm.content);
    const data = JSON.parse(decrypted);
    const from = nip19.npubEncode(dm.pubkey).slice(0, 20);
    console.log(`   From: ${from}...`);
    console.log(`   Type: ${data.type}`);
    console.log(`   Message: "${data.message}"`);
    if (data.offer) console.log(`   Offer: ${data.offer} sats`);
    console.log('');
  } catch (e) {
    console.log('   (Could not decrypt - not for us or corrupted)');
  }
}

pool.close(RELAYS);
console.log('=== DM TEST COMPLETE ===');
console.log('\nYou can also see these DMs in Primal/Damus if you import Ripper\'s nsec!');
