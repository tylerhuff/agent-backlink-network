/**
 * Link Verification - Check if backlinks exist on pages
 */

import type { VerificationResult } from '../types/index.js';

/**
 * Verify that a page contains a link to the target URL
 */
export async function verifyLink(pageUrl: string, targetUrl: string): Promise<VerificationResult> {
  const result: VerificationResult = {
    url: pageUrl,
    targetUrl,
    found: false,
    checkedAt: Date.now(),
  };

  try {
    const response = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'AgentBacklinkNetwork/1.0 (Link Verification Bot)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      result.error = `HTTP ${response.status}`;
      return result;
    }

    const html = await response.text();
    
    // Parse target URL to match variations
    const targetParsed = new URL(targetUrl);
    const targetPatterns = [
      targetUrl,
      targetUrl.replace(/\/$/, ''), // Without trailing slash
      targetUrl + '/', // With trailing slash
      targetParsed.hostname + targetParsed.pathname, // Without protocol
    ];

    // Look for links in the HTML
    // Simple regex approach - could use proper HTML parser for production
    const linkRegex = /<a\s+([^>]*href\s*=\s*["']([^"']+)["'][^>]*)>/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      const fullTag = match[1];
      const href = match[2];

      // Check if href matches any of our target patterns
      const hrefLower = href.toLowerCase();
      const matchesTarget = targetPatterns.some(pattern => 
        hrefLower === pattern.toLowerCase() ||
        hrefLower.includes(pattern.toLowerCase()) ||
        pattern.toLowerCase().includes(hrefLower)
      );

      if (matchesTarget) {
        result.found = true;

        // Extract anchor text (text between <a> and </a>)
        const afterTag = html.slice(match.index + match[0].length);
        const endTag = afterTag.indexOf('</a>');
        if (endTag > 0) {
          const anchorContent = afterTag.slice(0, endTag);
          // Remove HTML tags from anchor text
          result.anchorText = anchorContent.replace(/<[^>]+>/g, '').trim();
        }

        // Check for nofollow, sponsored, ugc
        const relMatch = fullTag.match(/rel\s*=\s*["']([^"']+)["']/i);
        if (relMatch) {
          const rel = relMatch[1].toLowerCase();
          if (rel.includes('nofollow')) result.linkType = 'nofollow';
          else if (rel.includes('sponsored')) result.linkType = 'sponsored';
          else if (rel.includes('ugc')) result.linkType = 'ugc';
        } else {
          result.linkType = 'dofollow';
        }

        break;
      }
    }

    // If not found via href, try a simpler text search
    if (!result.found) {
      const simpleMatch = targetPatterns.some(pattern => 
        html.toLowerCase().includes(`href="${pattern.toLowerCase()}"`) ||
        html.toLowerCase().includes(`href='${pattern.toLowerCase()}'`)
      );
      if (simpleMatch) {
        result.found = true;
        result.linkType = 'dofollow'; // Assume dofollow if we can't parse properly
      }
    }

    return result;

  } catch (error: any) {
    result.error = error.message || 'Unknown error';
    return result;
  }
}

/**
 * Verify multiple links in parallel
 */
export async function verifyLinks(
  checks: { pageUrl: string; targetUrl: string }[]
): Promise<VerificationResult[]> {
  return Promise.all(
    checks.map(({ pageUrl, targetUrl }) => verifyLink(pageUrl, targetUrl))
  );
}

/**
 * Extract all outbound links from a page
 */
export async function extractLinks(pageUrl: string): Promise<string[]> {
  try {
    const response = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'AgentBacklinkNetwork/1.0 (Link Extraction Bot)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return [];

    const html = await response.text();
    const links: string[] = [];
    
    const linkRegex = /href\s*=\s*["']([^"']+)["']/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      // Only include external links
      if (href.startsWith('http://') || href.startsWith('https://')) {
        links.push(href);
      }
    }

    return [...new Set(links)]; // Remove duplicates
  } catch {
    return [];
  }
}
