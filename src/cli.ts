#!/usr/bin/env node
/**
 * Agent Backlink Network CLI
 * 
 * Usage:
 *   abn register-site     - Register a site on Nostr
 *   abn find-matches      - Find sites looking for link exchanges
 *   abn propose           - Propose a link exchange
 *   abn inbox             - Check incoming proposals
 *   abn accept            - Accept a proposal
 *   abn verify            - Verify a link exists on a page
 *   abn status            - Show your identity and stats
 */

import { webcrypto } from 'node:crypto';
// @ts-ignore - polyfill for Node < 20
if (!globalThis.crypto) globalThis.crypto = webcrypto;

import 'websocket-polyfill';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { randomUUID } from 'crypto';

import { NostrClient, parseSiteEvent, DEFAULT_RELAYS } from './lib/nostr.js';
import { verifyLink } from './lib/verifier.js';
import {
  loadState,
  saveState,
  addSite,
  getSites,
  addOutgoingProposal,
  addIncomingProposal,
  updateProposalStatus,
  getPendingProposals,
  getStatePath,
  exportIdentity,
  importIdentity,
} from './lib/state.js';
import type { SiteRegistration, ExchangeProposal, ExchangeAccept, ExchangeReject } from './types/index.js';

const program = new Command();

program
  .name('abn')
  .description('Agent Backlink Network - Decentralized link exchange for AI agents')
  .version('0.1.0');

// Status command
program
  .command('status')
  .description('Show your agent identity and stats')
  .action(async () => {
    const state = loadState();
    const identity = exportIdentity();
    
    console.log(chalk.bold('\n🤖 Agent Backlink Network\n'));
    console.log(chalk.cyan('Identity:'));
    console.log(`  Public Key: ${chalk.dim(state.publicKey)}`);
    console.log(`  npub: ${chalk.green(identity.npub)}`);
    console.log(`  nsec: ${chalk.yellow(identity.nsec.slice(0, 20))}... (keep secret!)`);
    console.log(`\n  State file: ${chalk.dim(getStatePath())}`);
    
    console.log(chalk.cyan('\nSites:'), state.sites.length);
    for (const site of state.sites) {
      console.log(`  - ${site.businessName} (${site.url})`);
    }
    
    console.log(chalk.cyan('\nPending Proposals:'), getPendingProposals().length);
    console.log(chalk.cyan('Completed Exchanges:'), state.completedExchanges.length);
    
    console.log(chalk.cyan('\nRelays:'));
    for (const relay of state.relays) {
      console.log(`  - ${relay}`);
    }
    console.log();
  });

// Register site command
program
  .command('register-site')
  .description('Register a site on the Nostr network')
  .requiredOption('-u, --url <url>', 'Site URL')
  .requiredOption('-n, --name <name>', 'Business name')
  .requiredOption('-t, --type <type>', 'Business type (e.g., plumber, hvac, electrician)')
  .requiredOption('-c, --city <city>', 'City')
  .requiredOption('-s, --state <state>', 'State/Province')
  .option('--country <country>', 'Country', 'US')
  .option('-r, --radius <miles>', 'Service radius in miles', '25')
  .option('-p, --pages <pages>', 'Link pages (comma separated)', '/partners')
  .option('-l, --looking-for <types>', 'Industries looking for (comma separated)')
  .option('-d, --da <da>', 'Domain authority')
  .action(async (options) => {
    const spinner = ora('Registering site on Nostr...').start();

    try {
      const state = loadState();
      const client = new NostrClient(state.privateKey, state.relays);

      const site: SiteRegistration = {
        url: options.url,
        businessName: options.name,
        businessType: options.type.toLowerCase(),
        location: {
          city: options.city,
          state: options.state,
          country: options.country,
          radiusMiles: parseInt(options.radius),
        },
        linkPages: options.pages.split(',').map((p: string) => p.trim()),
        lookingFor: options.lookingFor
          ? options.lookingFor.split(',').map((t: string) => t.trim().toLowerCase())
          : [],
        ...(options.da ? { domainAuthority: parseInt(options.da) } : {}),
      };

      // Save locally
      addSite(site);

      // Publish to Nostr
      const event = await client.registerSite(site);
      
      spinner.succeed('Site registered!');
      console.log(chalk.green(`\n✓ ${site.businessName} is now on the network`));
      console.log(chalk.dim(`  Event ID: ${event.id}`));
      console.log(chalk.dim(`  URL: ${site.url}`));
      console.log(chalk.dim(`  Type: ${site.businessType}`));
      console.log(chalk.dim(`  Location: ${site.location.city}, ${site.location.state}`));
      console.log(chalk.dim(`  Looking for: ${site.lookingFor.join(', ') || 'any'}`));

      client.close();
    } catch (error: any) {
      spinner.fail('Failed to register site');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Find matches command
program
  .command('find-matches')
  .description('Find sites looking for link exchanges')
  .option('-t, --type <types>', 'Filter by business types (comma separated)')
  .option('-s, --state <state>', 'Filter by state')
  .option('--looking-for <type>', 'Filter by what they want (your business type)')
  .action(async (options) => {
    const spinner = ora('Searching for matches on Nostr...').start();

    try {
      const state = loadState();
      const client = new NostrClient(state.privateKey, state.relays);

      const events = await client.findSites({
        businessTypes: options.type?.split(',').map((t: string) => t.trim().toLowerCase()),
        state: options.state,
        lookingFor: options.lookingFor?.split(',').map((t: string) => t.trim().toLowerCase()),
      });

      spinner.succeed(`Found ${events.length} potential matches`);

      // Parse events and filter out invalid ones
      const sites = events.map(e => parseSiteEvent(e)).filter(Boolean);

      if (sites.length === 0) {
        console.log(chalk.yellow('\nNo matches found. Try different filters or wait for more sites to register.'));
      } else {
        console.log(chalk.cyan('\n📋 Registered Sites:\n'));
        
        for (const site of sites) {
          if (!site) continue;
          console.log(chalk.bold(`${site.businessName}`));
          console.log(`  URL: ${chalk.blue(site.url)}`);
          console.log(`  Type: ${site.businessType}`);
          console.log(`  Location: ${site.location.city}, ${site.location.state}`);
          console.log(`  Link Pages: ${site.linkPages.join(', ')}`);
          console.log(`  Looking For: ${site.lookingFor.join(', ') || 'any'}`);
          console.log(`  Agent: ${chalk.dim(site.pubkey.slice(0, 16))}...`);
          console.log();
        }

        console.log(chalk.dim(`Use 'abn propose --from <your-site-url> --to <their-site-url>' to propose an exchange`));
      }

      client.close();
    } catch (error: any) {
      spinner.fail('Failed to search');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Propose exchange command
program
  .command('propose')
  .description('Propose a link exchange to another agent')
  .requiredOption('--from <url>', 'Your site URL')
  .requiredOption('--to <url>', 'Their site URL')
  .option('--page <page>', 'Page where you will place the link', '/partners')
  .option('--anchor <text>', 'Preferred anchor text')
  .option('--message <msg>', 'Optional message')
  .action(async (options) => {
    const spinner = ora('Finding target site...').start();

    try {
      const state = loadState();
      const client = new NostrClient(state.privateKey, state.relays);

      // Find the target site to get their pubkey
      const events = await client.findSites({});
      const targetEvent = events.find(e => {
        const site = parseSiteEvent(e);
        return site?.url === options.to;
      });

      if (!targetEvent) {
        spinner.fail(`Site not found: ${options.to}`);
        console.log(chalk.yellow('Make sure the site is registered on the network.'));
        process.exit(1);
      }

      const targetSite = parseSiteEvent(targetEvent);

      spinner.text = 'Sending proposal...';

      const proposal: ExchangeProposal = {
        type: 'proposal',
        proposalId: randomUUID(),
        fromSite: options.from,
        toSite: options.to,
        linkPage: options.page,
        anchorText: options.anchor,
        message: options.message,
      };

      // Send encrypted DM to target agent
      await client.sendDM(targetSite.pubkey, proposal);

      // Save locally
      addOutgoingProposal(proposal, targetSite.pubkey);

      spinner.succeed('Proposal sent!');
      console.log(chalk.green(`\n✓ Exchange proposal sent to ${targetSite.businessName}`));
      console.log(chalk.dim(`  Proposal ID: ${proposal.proposalId}`));
      console.log(chalk.dim(`  Your site: ${proposal.fromSite}`));
      console.log(chalk.dim(`  Their site: ${proposal.toSite}`));
      console.log(chalk.dim(`  Link page: ${proposal.linkPage}`));
      console.log(chalk.yellow('\nWait for them to accept. Check with: abn inbox'));

      client.close();
    } catch (error: any) {
      spinner.fail('Failed to send proposal');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Inbox command
program
  .command('inbox')
  .description('Check incoming proposals and messages')
  .action(async () => {
    const spinner = ora('Checking inbox...').start();

    try {
      const state = loadState();
      const client = new NostrClient(state.privateKey, state.relays);

      // Get DMs from last 30 days
      const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
      const messages = await client.getDMs(since);

      // Filter for proposals and accepts
      const proposals: any[] = [];
      const accepts: any[] = [];
      const rejects: any[] = [];

      for (const { from, message, event } of messages) {
        if (message.type === 'proposal') {
          proposals.push({ from, message, event });
          addIncomingProposal(message, from);
        } else if (message.type === 'accept') {
          accepts.push({ from, message, event });
          updateProposalStatus(message.proposalId, 'accepted');
        } else if (message.type === 'reject') {
          rejects.push({ from, message, event });
          updateProposalStatus(message.proposalId, 'rejected');
        }
      }

      spinner.succeed('Inbox checked');

      console.log(chalk.cyan('\n📬 Inbox\n'));

      if (proposals.length === 0 && accepts.length === 0 && rejects.length === 0) {
        console.log(chalk.dim('No new messages.'));
      }

      if (proposals.length > 0) {
        console.log(chalk.bold('New Proposals:'));
        for (const { from, message } of proposals) {
          console.log(`  From: ${chalk.dim(from.slice(0, 16))}...`);
          console.log(`    Their site: ${message.fromSite}`);
          console.log(`    Your site: ${message.toSite}`);
          console.log(`    Link page: ${message.linkPage}`);
          console.log(`    ID: ${chalk.yellow(message.proposalId)}`);
          if (message.message) console.log(`    Message: ${message.message}`);
          console.log();
        }
        console.log(chalk.dim(`Accept with: abn accept --id <proposal-id> --page <your-link-page>`));
      }

      if (accepts.length > 0) {
        console.log(chalk.bold(chalk.green('Accepted Proposals:')));
        for (const { message } of accepts) {
          console.log(`  Proposal: ${message.proposalId}`);
          console.log(`  Their link page: ${message.linkPage}`);
          console.log();
        }
        console.log(chalk.dim('Time to place the links!'));
      }

      if (rejects.length > 0) {
        console.log(chalk.bold(chalk.red('Rejected Proposals:')));
        for (const { message } of rejects) {
          console.log(`  Proposal: ${message.proposalId}`);
          if (message.reason) console.log(`  Reason: ${message.reason}`);
        }
      }

      // Show local pending proposals
      const pending = getPendingProposals();
      if (pending.length > 0) {
        console.log(chalk.bold('\nLocal Pending Proposals:'));
        for (const p of pending) {
          console.log(`  ${p.direction === 'incoming' ? '⬇️' : '⬆️'} ${p.proposal.fromSite} ↔️ ${p.proposal.toSite}`);
          console.log(`    ID: ${p.id} | Status: ${p.status}`);
        }
      }

      client.close();
    } catch (error: any) {
      spinner.fail('Failed to check inbox');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Accept command
program
  .command('accept')
  .description('Accept a link exchange proposal')
  .requiredOption('--id <id>', 'Proposal ID')
  .requiredOption('--page <page>', 'Page where you will place the link')
  .option('--anchor <text>', 'Your preferred anchor text')
  .option('--message <msg>', 'Optional message')
  .action(async (options) => {
    const spinner = ora('Sending acceptance...').start();

    try {
      const state = loadState();
      const client = new NostrClient(state.privateKey, state.relays);

      // Find the proposal
      const proposal = state.pendingProposals.find(p => p.id === options.id);
      if (!proposal) {
        spinner.fail('Proposal not found');
        console.log(chalk.yellow('Check your inbox first: abn inbox'));
        process.exit(1);
      }

      const accept: ExchangeAccept = {
        type: 'accept',
        proposalId: options.id,
        linkPage: options.page,
        anchorText: options.anchor,
        message: options.message,
      };

      // Send acceptance to proposer
      await client.sendDM(proposal.fromPubkey, accept);

      // Update local state
      updateProposalStatus(options.id, 'accepted');

      spinner.succeed('Proposal accepted!');
      console.log(chalk.green(`\n✓ Exchange accepted`));
      console.log(chalk.dim(`  Your link page: ${options.page}`));
      console.log(chalk.yellow('\nNow both parties should place the links and verify.'));
      console.log(chalk.dim(`Verify with: abn verify --url <page-url> --target <link-target>`));

      client.close();
    } catch (error: any) {
      spinner.fail('Failed to accept proposal');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Reject command  
program
  .command('reject')
  .description('Reject a link exchange proposal')
  .requiredOption('--id <id>', 'Proposal ID')
  .option('--reason <reason>', 'Optional reason')
  .action(async (options) => {
    const spinner = ora('Sending rejection...').start();

    try {
      const state = loadState();
      const client = new NostrClient(state.privateKey, state.relays);

      const proposal = state.pendingProposals.find(p => p.id === options.id);
      if (!proposal) {
        spinner.fail('Proposal not found');
        process.exit(1);
      }

      const reject: ExchangeReject = {
        type: 'reject',
        proposalId: options.id,
        reason: options.reason,
      };

      await client.sendDM(proposal.fromPubkey, reject);
      updateProposalStatus(options.id, 'rejected');

      spinner.succeed('Proposal rejected');
      client.close();
    } catch (error: any) {
      spinner.fail('Failed to reject proposal');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Verify command
program
  .command('verify')
  .description('Verify a link exists on a page')
  .requiredOption('--url <url>', 'Page URL to check')
  .requiredOption('--target <target>', 'Link target URL to find')
  .action(async (options) => {
    const spinner = ora(`Checking ${options.url}...`).start();

    try {
      const result = await verifyLink(options.url, options.target);

      if (result.found) {
        spinner.succeed('Link found!');
        console.log(chalk.green(`\n✓ Link verified`));
        console.log(`  Page: ${result.url}`);
        console.log(`  Target: ${result.targetUrl}`);
        console.log(`  Anchor: ${result.anchorText || '(unknown)'}`);
        console.log(`  Type: ${result.linkType || 'unknown'}`);
      } else {
        spinner.fail('Link not found');
        console.log(chalk.red(`\n✗ Link not found`));
        console.log(`  Page: ${result.url}`);
        console.log(`  Looking for: ${result.targetUrl}`);
        if (result.error) console.log(`  Error: ${result.error}`);
      }
    } catch (error: any) {
      spinner.fail('Verification failed');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Complete exchange command
program
  .command('complete')
  .description('Mark an exchange as complete (publishes public record)')
  .requiredOption('--id <id>', 'Proposal ID')
  .requiredOption('--link-a <url>', 'Full URL where your link is placed')
  .requiredOption('--link-b <url>', 'Full URL where their link is placed')
  .action(async (options) => {
    const spinner = ora('Publishing completion record...').start();

    try {
      const state = loadState();
      const client = new NostrClient(state.privateKey, state.relays);

      const proposal = state.pendingProposals.find(p => p.id === options.id);
      if (!proposal) {
        spinner.fail('Proposal not found');
        process.exit(1);
      }

      // Verify both links exist
      spinner.text = 'Verifying links...';
      const [resultA, resultB] = await Promise.all([
        verifyLink(options.linkA, proposal.proposal.toSite),
        verifyLink(options.linkB, proposal.proposal.fromSite),
      ]);

      if (!resultA.found || !resultB.found) {
        spinner.fail('Cannot complete: links not verified');
        if (!resultA.found) console.log(chalk.red(`  ✗ Link not found at ${options.linkA}`));
        if (!resultB.found) console.log(chalk.red(`  ✗ Link not found at ${options.linkB}`));
        process.exit(1);
      }

      spinner.text = 'Publishing...';

      const exchange = {
        proposalId: options.id,
        siteA: {
          url: proposal.proposal.fromSite,
          linkPage: proposal.proposal.linkPage,
          linkUrl: options.linkA,
        },
        siteB: {
          url: proposal.proposal.toSite,
          linkPage: options.linkB,
          linkUrl: options.linkB,
        },
        completedAt: Date.now(),
        verified: true,
      };

      await client.publishExchangeComplete(exchange);
      updateProposalStatus(options.id, 'completed');

      spinner.succeed('Exchange completed!');
      console.log(chalk.green(`\n🎉 Exchange complete and published!`));
      console.log(chalk.dim('This is now a public record on Nostr.'));

      client.close();
    } catch (error: any) {
      spinner.fail('Failed to complete exchange');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Export identity
program
  .command('export')
  .description('Export your identity (nsec) for backup')
  .action(() => {
    const identity = exportIdentity();
    console.log(chalk.cyan('\n🔑 Your Identity\n'));
    console.log(`Public Key (npub): ${chalk.green(identity.npub)}`);
    console.log(`Secret Key (nsec): ${chalk.yellow(identity.nsec)}`);
    console.log(chalk.red('\n⚠️  Keep your nsec SECRET! Anyone with it can impersonate you.'));
  });

// Import identity
program
  .command('import')
  .description('Import an existing identity')
  .requiredOption('--nsec <nsec>', 'Your secret key (nsec...)')
  .action((options) => {
    try {
      const state = importIdentity(options.nsec);
      console.log(chalk.green('\n✓ Identity imported successfully!'));
      console.log(`  npub: ${state.npub}`);
    } catch (error: any) {
      console.error(chalk.red('Failed to import identity:', error.message));
      process.exit(1);
    }
  });

// List my sites
program
  .command('my-sites')
  .description('List your registered sites')
  .action(() => {
    const sites = getSites();
    
    console.log(chalk.cyan('\n📋 Your Sites\n'));
    
    if (sites.length === 0) {
      console.log(chalk.dim('No sites registered yet.'));
      console.log(chalk.dim('Register one with: abn register-site'));
    } else {
      for (const site of sites) {
        console.log(chalk.bold(site.businessName));
        console.log(`  URL: ${chalk.blue(site.url)}`);
        console.log(`  Type: ${site.businessType}`);
        console.log(`  Location: ${site.location.city}, ${site.location.state}`);
        console.log(`  Link Pages: ${site.linkPages.join(', ')}`);
        console.log(`  Looking For: ${site.lookingFor.join(', ') || 'any'}`);
        console.log();
      }
    }
  });

program.parse();
