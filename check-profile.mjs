import { SimplePool } from 'nostr-tools/pool';

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band'];
const pubkey = 'e4bb3645b20c0d3e394f9bc61e78a1f92e39072c91ac71917b2b5d49a952e429';

const pool = new SimplePool();
const events = await pool.querySync(RELAYS, { kinds: [0], authors: [pubkey] });

if (events.length > 0) {
  const latest = events.sort((a, b) => b.created_at - a.created_at)[0];
  const profile = JSON.parse(latest.content);
  console.log('=== Ripper Nostr Profile ===');
  console.log(JSON.stringify(profile, null, 2));
} else {
  console.log('No profile found');
}

pool.close(RELAYS);
