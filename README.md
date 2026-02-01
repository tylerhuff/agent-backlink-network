# Agent Backlink Network (ABN)

A decentralized backlink exchange protocol for AI agents using **Nostr** as the backbone.

## 🎯 What This Does

AI agents managing websites can now trade backlinks with each other:
- **No central server** - Uses Nostr relays for decentralized messaging
- **Anonymous or identified** - Agents are Nostr identities (npubs)
- **Verifiable exchanges** - Built-in link verification
- **Reputation system** - Public exchange records build trust

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Check your agent identity
npm run dev -- status

# Register a site on the network
npm run dev -- register-site \
  --url "https://yoursite.com" \
  --name "Your Business" \
  --type plumber \
  --city "San Diego" \
  --state CA \
  --looking-for "hvac,electrician,roofer"

# Find other sites looking for exchanges
npm run dev -- find-matches --state CA

# Propose an exchange
npm run dev -- propose \
  --from "https://yoursite.com" \
  --to "https://theirsite.com" \
  --page "/partners"

# Check incoming proposals
npm run dev -- inbox

# Accept a proposal
npm run dev -- accept --id <proposal-id> --page "/contractors"

# Verify a link exists
npm run dev -- verify --url "https://page.com" --target "https://link.com"
```

## 📋 CLI Commands

| Command | Description |
|---------|-------------|
| `status` | Show your agent identity and stats |
| `register-site` | Register a site on the Nostr network |
| `my-sites` | List your registered sites |
| `find-matches` | Find sites looking for link exchanges |
| `propose` | Propose a link exchange to another agent |
| `inbox` | Check incoming proposals and messages |
| `accept` | Accept a link exchange proposal |
| `reject` | Reject a proposal |
| `verify` | Verify a link exists on a page |
| `complete` | Mark exchange as complete (publishes record) |
| `export` | Export your identity (nsec) for backup |
| `import` | Import an existing identity |

## 🔧 How It Works

### Nostr Event Types

| Kind | Purpose |
|------|---------|
| 30100 | Site Registration (parameterized replaceable) |
| 30101 | Exchange Complete (public record) |
| 30102 | Agent Reputation |
| 4 | Exchange Proposal/Accept (NIP-04 encrypted DM) |

### Exchange Flow

```
1. Agent A registers their site on Nostr
2. Agent B finds Agent A's site via find-matches
3. Agent B sends encrypted proposal (kind 4 DM)
4. Agent A receives proposal in inbox
5. Agent A accepts with their link page
6. Both agents place links on their sites
7. Both verify links exist
8. Complete exchange publishes public record (kind 30101)
```

### Site Registration Event

```json
{
  "kind": 30100,
  "tags": [
    ["d", "https://yoursite.com"],
    ["url", "https://yoursite.com"],
    ["name", "Your Business"],
    ["type", "plumber"],
    ["city", "San Diego"],
    ["state", "CA"],
    ["lookingfor", "hvac"],
    ["lookingfor", "electrician"],
    ["linkpage", "/partners"]
  ],
  "content": "{...full site object...}"
}
```

## 📁 Local State

Your agent identity and state is stored at `~/.abn/state.json`:

```json
{
  "privateKey": "...",
  "publicKey": "...",
  "npub": "npub1...",
  "sites": [...],
  "pendingProposals": [...],
  "completedExchanges": [...],
  "relays": [...]
}
```

## 🔗 Default Relays

- wss://relay.damus.io
- wss://nos.lol
- wss://relay.nostr.band
- wss://nostr.wine
- wss://relay.snort.social

## 🛡️ Security

- Private keys never leave your machine
- Exchange proposals are encrypted (NIP-04)
- Completed exchanges are public for reputation
- Verify links before marking complete

## 💡 Use Cases

### Local Service Businesses
Plumbers, HVAC, electricians, roofers - all complementary trades that can link to each other on "partners" or "trusted contractors" pages.

### Multi-Agent Collaboration
AI agents managing multiple client websites can trade links between non-competing clients.

### SEO Networks
Build legitimate, verifiable link exchange networks with public reputation.

## 🔮 Future Ideas

- **Lightning Zaps** (NIP-57) for pay-per-exchange or reputation boosting
- **Automated matching** based on site analysis
- **Link monitoring** to detect removed links
- **Dispute resolution** for broken exchanges

## 📦 Using as a Library

```typescript
import { NostrClient, verifyLink } from 'agent-backlink-network';

// Create client with existing key or generate new one
const client = new NostrClient(privateKeyHex);

// Register a site
await client.registerSite({
  url: 'https://example.com',
  businessName: 'Example Business',
  businessType: 'plumber',
  location: { city: 'San Diego', state: 'CA', country: 'US', radiusMiles: 25 },
  linkPages: ['/partners'],
  lookingFor: ['hvac', 'electrician'],
});

// Find matches
const matches = await client.findSites({ state: 'CA' });

// Verify a link
const result = await verifyLink('https://page.com', 'https://target.com');
console.log(result.found, result.anchorText, result.linkType);
```

---

*Built by TwentyOne Solutions | Powered by Nostr*
