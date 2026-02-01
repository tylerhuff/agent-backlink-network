import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

const sk = generateSecretKey();
const pk = getPublicKey(sk);

console.log('=== Test Agent 2 ===');
console.log('nsec:', nip19.nsecEncode(sk));
console.log('npub:', nip19.npubEncode(pk));
console.log('hex privkey:', Buffer.from(sk).toString('hex'));
