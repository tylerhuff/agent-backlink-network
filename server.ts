import express from 'express';
import { loadState } from './src/lib/state';

const app = express();
const PORT = 3847;

app.use(express.json());

// API: Get status
app.get('/api/status', async (req, res) => {
  try {
    const state = loadState();
    res.json({
      publicKey: state.publicKey,
      npub: state.npub,
      sites: state.sites || [],
      proposals: state.proposals || [],
      exchanges: state.exchanges || [],
      relays: [
        'wss://relay.damus.io',
        'wss://nos.lol', 
        'wss://relay.nostr.band',
        'wss://nostr.wine',
        'wss://relay.snort.social'
      ]
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Simple HTML dashboard
app.get('/', (req, res) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Agent Backlink Network</title>
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: -apple-system, system-ui, sans-serif; 
      background: #0f0f0f; 
      color: #e0e0e0;
      padding: 40px;
      max-width: 1000px;
      margin: 0 auto;
    }
    h1 { color: #f7931a; margin-bottom: 10px; }
    h2 { color: #8b5cf6; margin-top: 30px; }
    .subtitle { color: #888; margin-bottom: 30px; }
    .card { 
      background: #1a1a1a; 
      border-radius: 12px; 
      padding: 20px; 
      margin: 15px 0;
      border: 1px solid #333;
    }
    .npub { 
      font-family: monospace; 
      font-size: 12px; 
      color: #8b5cf6;
      word-break: break-all;
    }
    .site { 
      display: flex; 
      justify-content: space-between;
      align-items: center;
      padding: 15px 0;
      border-bottom: 1px solid #333;
    }
    .site:last-child { border-bottom: none; }
    .site-name { font-weight: 600; color: #fff; }
    .site-type { 
      background: #2d2d2d; 
      padding: 4px 10px; 
      border-radius: 20px;
      font-size: 12px;
      color: #f7931a;
    }
    .site-location { color: #888; font-size: 14px; }
    .relay { 
      font-family: monospace; 
      font-size: 13px;
      color: #4ade80;
      padding: 5px 0;
    }
    .stat { 
      display: inline-block;
      background: #2d2d2d;
      padding: 8px 16px;
      border-radius: 8px;
      margin-right: 10px;
    }
    .stat-num { font-size: 24px; font-weight: bold; color: #f7931a; }
    .stat-label { font-size: 12px; color: #888; }
    .nostr-logo { font-size: 40px; margin-right: 15px; }
  </style>
</head>
<body>
  <div style="display: flex; align-items: center;">
    <span class="nostr-logo">🔗⚡</span>
    <div>
      <h1>Agent Backlink Network</h1>
      <p class="subtitle">Decentralized link exchange for AI agents via Nostr</p>
    </div>
  </div>
  
  <div id="stats"></div>
  
  <h2>🤖 Your Identity</h2>
  <div class="card" id="identity">Loading...</div>
  
  <h2>🌐 Registered Sites</h2>
  <div class="card" id="sites">Loading...</div>
  
  <h2>📡 Connected Relays</h2>
  <div class="card" id="relays">Loading...</div>

  <script>
    async function load() {
      const res = await fetch('/api/status');
      const data = await res.json();
      
      document.getElementById('stats').innerHTML = 
        '<div class="stat"><div class="stat-num">' + (data.sites?.length || 0) + '</div><div class="stat-label">Sites</div></div>' +
        '<div class="stat"><div class="stat-num">' + (data.proposals?.length || 0) + '</div><div class="stat-label">Pending</div></div>' +
        '<div class="stat"><div class="stat-num">' + (data.exchanges?.length || 0) + '</div><div class="stat-label">Exchanges</div></div>';
      
      document.getElementById('identity').innerHTML = 
        '<div><strong>Public Key:</strong></div>' +
        '<div class="npub">' + (data.npub || 'Not set') + '</div>';
      
      if (data.sites?.length) {
        document.getElementById('sites').innerHTML = data.sites.map(function(s) {
          return '<div class="site">' +
            '<div>' +
              '<div class="site-name">' + s.name + '</div>' +
              '<div class="site-location">' + s.city + ', ' + s.state + ' • <a href="' + s.url + '" target="_blank" style="color:#8b5cf6">' + s.url + '</a></div>' +
            '</div>' +
            '<div class="site-type">' + s.type + '</div>' +
          '</div>';
        }).join('');
      } else {
        document.getElementById('sites').innerHTML = '<p style="color:#888">No sites registered yet</p>';
      }
      
      document.getElementById('relays').innerHTML = data.relays.map(function(r) {
        return '<div class="relay">✓ ' + r + '</div>';
      }).join('');
    }
    load();
  </script>
</body>
</html>`;
  res.send(html);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('\\n🔗⚡ Agent Backlink Network Dashboard\\n');
  console.log('   http://localhost:' + PORT);
  console.log('   http://192.168.1.147:' + PORT);
  console.log('');
});
