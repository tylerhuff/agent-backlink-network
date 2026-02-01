/**
 * Agent Backlink Network - Local Proof of Concept
 * 
 * This simulates how the network would work locally,
 * storing data in a JSON file instead of a real server.
 */

import fs from 'fs';
import crypto from 'crypto';

const DB_PATH = './network-db.json';

interface Site {
  id: string;
  url: string;
  businessName: string;
  businessType: string;
  city: string;
  state: string;
  agentId: string;
  linkPages: string[];
  lookingFor: string[];
  domainAuthority: number;
}

interface Exchange {
  id: string;
  status: string;
  siteA: { siteId: string; linkPage: string; placed: boolean };
  siteB: { siteId: string; linkPage: string; placed: boolean };
}

interface DB {
  sites: Site[];
  exchanges: Exchange[];
}

function loadDB(): DB {
  if (fs.existsSync(DB_PATH)) {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  }
  return { sites: [], exchanges: [] };
}

function saveDB(db: DB) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// Register a site in the network
export function registerSite(site: Omit<Site, 'id'>): Site {
  const db = loadDB();
  const newSite: Site = {
    ...site,
    id: crypto.randomUUID()
  };
  db.sites.push(newSite);
  saveDB(db);
  console.log(`✅ Registered: ${site.businessName} (${site.url})`);
  return newSite;
}

// Find matching sites for link exchange
export function findMatches(siteId: string): Site[] {
  const db = loadDB();
  const site = db.sites.find(s => s.id === siteId);
  if (!site) throw new Error('Site not found');
  
  return db.sites.filter(s => {
    // Don't match with self
    if (s.id === siteId) return false;
    // Don't match with same agent's sites (no self-linking)
    if (s.agentId === site.agentId) return false;
    // Match if they're looking for our type
    if (!s.lookingFor.includes(site.businessType)) return false;
    // Match if we're looking for their type
    if (!site.lookingFor.includes(s.businessType)) return false;
    // Same state (local relevance)
    if (s.state !== site.state) return false;
    return true;
  });
}

// Propose a link exchange
export function proposeExchange(fromSiteId: string, toSiteId: string, linkPage: string): Exchange {
  const db = loadDB();
  const exchange: Exchange = {
    id: crypto.randomUUID(),
    status: 'proposed',
    siteA: { siteId: fromSiteId, linkPage, placed: false },
    siteB: { siteId: toSiteId, linkPage: '', placed: false }
  };
  db.exchanges.push(exchange);
  saveDB(db);
  console.log(`📤 Exchange proposed: ${exchange.id}`);
  return exchange;
}

// Accept an exchange
export function acceptExchange(exchangeId: string, linkPage: string): Exchange {
  const db = loadDB();
  const exchange = db.exchanges.find(e => e.id === exchangeId);
  if (!exchange) throw new Error('Exchange not found');
  exchange.status = 'accepted';
  exchange.siteB.linkPage = linkPage;
  saveDB(db);
  console.log(`✅ Exchange accepted: ${exchangeId}`);
  return exchange;
}

// Mark link as placed
export function markPlaced(exchangeId: string, siteId: string): Exchange {
  const db = loadDB();
  const exchange = db.exchanges.find(e => e.id === exchangeId);
  if (!exchange) throw new Error('Exchange not found');
  
  if (exchange.siteA.siteId === siteId) {
    exchange.siteA.placed = true;
  } else if (exchange.siteB.siteId === siteId) {
    exchange.siteB.placed = true;
  }
  
  if (exchange.siteA.placed && exchange.siteB.placed) {
    exchange.status = 'completed';
    console.log(`🎉 Exchange completed: ${exchangeId}`);
  }
  
  saveDB(db);
  return exchange;
}

// Demo: Simulate two agents trading links
async function demo() {
  console.log('\n🔗 Agent Backlink Network - Demo\n');
  
  // Agent 1 (Ripper) registers a plumber site
  const plumberSite = registerSite({
    url: 'https://acme-plumbing-sc.com',
    businessName: 'Acme Plumbing',
    businessType: 'plumber',
    city: 'San Clemente',
    state: 'CA',
    agentId: 'ripper@twentyone',
    linkPages: ['/partners', '/local-resources'],
    lookingFor: ['hvac', 'electrician', 'roofer', 'handyman'],
    domainAuthority: 15
  });
  
  // Agent 2 (another agent) registers an HVAC site
  const hvacSite = registerSite({
    url: 'https://cool-hvac-dp.com',
    businessName: 'Cool HVAC Services',
    businessType: 'hvac',
    city: 'Dana Point',
    state: 'CA',
    agentId: 'other-agent@example',
    linkPages: ['/trusted-contractors', '/resources'],
    lookingFor: ['plumber', 'electrician', 'roofer'],
    domainAuthority: 12
  });
  
  // Ripper finds matches for the plumber site
  console.log('\n🔍 Finding matches for Acme Plumbing...');
  const matches = findMatches(plumberSite.id);
  console.log(`Found ${matches.length} potential partners:`);
  matches.forEach(m => console.log(`  - ${m.businessName} (${m.businessType})`));
  
  if (matches.length > 0) {
    // Propose exchange with first match
    console.log('\n📤 Proposing link exchange...');
    const exchange = proposeExchange(plumberSite.id, matches[0].id, '/partners');
    
    // Other agent accepts
    console.log('\n✅ Other agent accepts...');
    acceptExchange(exchange.id, '/trusted-contractors');
    
    // Both place links
    console.log('\n🔗 Both agents place links...');
    markPlaced(exchange.id, plumberSite.id);
    markPlaced(exchange.id, matches[0].id);
  }
  
  console.log('\n✨ Demo complete! Check network-db.json for state.\n');
}

// Run demo if executed directly
demo().catch(console.error);
