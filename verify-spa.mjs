#!/usr/bin/env node
/**
 * SPA-aware link verification using Puppeteer
 * Renders the page with JavaScript before checking for links
 */

import puppeteer from 'puppeteer';

const checks = [
  {
    name: 'Master Care → Silicon Valley',
    pageUrl: 'https://master-care-lawn-service.vercel.app',
    targetDomain: 'silicon-valley-custom-homes.vercel.app',
    targetText: 'Silicon Valley Custom Homes'
  },
  {
    name: 'Silicon Valley → Master Care',
    pageUrl: 'https://silicon-valley-custom-homes.vercel.app',
    targetDomain: 'master-care-lawn-service.vercel.app',
    targetText: 'Master Care Lawn Service'
  }
];

async function verify() {
  console.log('🔍 ABN Partner Link Verification (SPA-aware)\n');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox']
  });
  
  const results = [];
  
  for (const check of checks) {
    console.log(`Checking: ${check.name}`);
    console.log(`  Page: ${check.pageUrl}`);
    
    const page = await browser.newPage();
    await page.goto(check.pageUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Wait for React to render
    await page.waitForFunction(() => {
      return document.querySelector('footer') !== null;
    }, { timeout: 15000 }).catch(() => {});
    
    // Check for partner link
    const found = await page.evaluate((targetDomain, targetText) => {
      const links = Array.from(document.querySelectorAll('a'));
      const partnerLink = links.find(a => 
        a.href.includes(targetDomain) || 
        a.textContent.includes(targetText)
      );
      
      if (partnerLink) {
        return {
          found: true,
          href: partnerLink.href,
          text: partnerLink.textContent.trim(),
          isDofollow: !partnerLink.rel.includes('nofollow')
        };
      }
      return { found: false };
    }, check.targetDomain, check.targetText);
    
    if (found.found) {
      console.log('  ✅ VERIFIED!');
      console.log(`  Link: ${found.href}`);
      console.log(`  Anchor: "${found.text}"`);
      console.log(`  Type: ${found.isDofollow ? 'dofollow' : 'nofollow'}`);
      results.push({ ...check, verified: true, ...found });
    } else {
      console.log('  ❌ Not found');
      results.push({ ...check, verified: false });
    }
    
    await page.close();
    console.log('');
  }
  
  await browser.close();
  
  // Summary
  console.log('═══════════════════════════════════════════');
  console.log('VERIFICATION SUMMARY');
  console.log('═══════════════════════════════════════════');
  const verified = results.filter(r => r.verified).length;
  console.log(`Total: ${verified}/${results.length} links verified`);
  
  if (verified === results.length) {
    console.log('\n🎉 ALL PARTNER LINKS ARE LIVE!');
  }
  
  return results;
}

verify().catch(console.error);
