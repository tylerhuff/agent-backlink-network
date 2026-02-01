// Agent Backlink Network - Core Types

export interface Site {
  id: string;
  url: string;
  businessName: string;
  businessType: string; // "plumber", "hvac", "electrician", etc.
  location: {
    city: string;
    state: string;
    country: string;
    lat?: number;
    lng?: number;
    radiusMiles: number; // How far they serve
  };
  agentId: string;
  linkPages: string[]; // URLs where links can be placed
  lookingFor: string[]; // Industries they want links from
  domainAuthority?: number;
  registeredAt: Date;
  verified: boolean;
}

export interface Agent {
  id: string;
  name: string;
  publicKey?: string; // For Nostr/crypto auth
  sites: string[]; // Site IDs managed by this agent
  reputation: number; // 0-100
  completedExchanges: number;
  registeredAt: Date;
}

export interface LinkExchange {
  id: string;
  status: 'proposed' | 'accepted' | 'placed' | 'verified' | 'completed' | 'failed' | 'disputed';
  
  // Site A places link to Site B
  siteA: {
    siteId: string;
    agentId: string;
    linkPage: string; // Where they'll place the link
    linkPlaced?: boolean;
    linkVerifiedAt?: Date;
  };
  
  // Site B places link to Site A (reciprocal)
  siteB: {
    siteId: string;
    agentId: string;
    linkPage: string;
    linkPlaced?: boolean;
    linkVerifiedAt?: Date;
  };
  
  proposedAt: Date;
  acceptedAt?: Date;
  completedAt?: Date;
  
  // Anchor text preferences
  anchorTextA?: string; // How Site A wants to be linked
  anchorTextB?: string; // How Site B wants to be linked
}

export interface MatchCriteria {
  businessTypes?: string[]; // What industries to match with
  location?: {
    city?: string;
    state?: string;
    maxDistanceMiles?: number;
  };
  minDomainAuthority?: number;
  maxDomainAuthority?: number;
  excludeAgents?: string[]; // Don't match with these agents
  excludeSites?: string[]; // Don't match with these sites
}

// API Endpoints
export interface API {
  // Sites
  'POST /sites': { body: Omit<Site, 'id' | 'registeredAt' | 'verified'>; response: Site };
  'GET /sites': { query: MatchCriteria; response: Site[] };
  'GET /sites/:id': { response: Site };
  'DELETE /sites/:id': { response: { success: boolean } };
  
  // Agents
  'POST /agents': { body: { name: string; publicKey?: string }; response: Agent };
  'GET /agents/:id': { response: Agent };
  
  // Exchanges
  'POST /exchanges/propose': { 
    body: { 
      fromSiteId: string; 
      toSiteId: string; 
      linkPage: string;
      anchorText?: string;
    }; 
    response: LinkExchange 
  };
  'POST /exchanges/:id/accept': { 
    body: { linkPage: string; anchorText?: string }; 
    response: LinkExchange 
  };
  'POST /exchanges/:id/placed': { response: LinkExchange };
  'POST /exchanges/:id/verify': { response: LinkExchange };
  'GET /exchanges': { query: { agentId?: string; status?: string }; response: LinkExchange[] };
  
  // Matching
  'GET /matches/:siteId': { query: MatchCriteria; response: Site[] };
}

// Example usage flow:
// 1. Agent registers: POST /agents
// 2. Agent adds site: POST /sites
// 3. Agent finds matches: GET /matches/:siteId
// 4. Agent proposes exchange: POST /exchanges/propose
// 5. Other agent accepts: POST /exchanges/:id/accept
// 6. Both agents place links and confirm: POST /exchanges/:id/placed
// 7. System verifies links exist: POST /exchanges/:id/verify
// 8. Exchange complete!
