#!/usr/bin/env node

/**
 * FAL_KEY Setup Script
 * Usage: node scripts/setup-fal-key.js [key]
 * If no key provided, prompts interactively
 */

import fs from 'fs';
import readline from 'readline';

const ENV_FILE = '.env.local';
const KEY_NAME = 'FAL_KEY';

// Color codes
const colors = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}${msg}${colors.reset}`),
  error: (msg) => console.error(`${colors.red}✗ ${msg}${colors.reset}`)
};

async function promptForKey() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(
      `${colors.yellow}Enter your FAL_KEY (get it from https://fal.ai): ${colors.reset}`,
      (answer) => {
        rl.close();
        resolve(answer.trim());
      }
    );
  });
}

function readEnvFile() {
  if (!fs.existsSync(ENV_FILE)) {
    return '';
  }
  return fs.readFileSync(ENV_FILE, 'utf-8');
}

function writeEnvFile(content) {
  fs.writeFileSync(ENV_FILE, content, 'utf-8');
}

function updateEnvKey(content, key, value) {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  
  if (regex.test(content)) {
    // Replace existing key
    return content.replace(regex, `${key}=${value}`);
  } else {
    // Append new key
    return content + (content.endsWith('\n') ? '' : '\n') + `${key}=${value}\n`;
  }
}

async function main() {
  log.info('=== FAL.AI Key Setup ===\n');

  let falKey = process.argv[2];

  if (!falKey) {
    log.warn('No key provided as argument');
    falKey = await promptForKey();
  } else {
    log.warn('Using provided key');
  }

  if (!falKey) {
    log.warn('No key provided. Skipping setup.');
    process.exit(0);
  }

  // Create .env.local if it doesn't exist
  if (!fs.existsSync(ENV_FILE)) {
    log.warn(`Creating ${ENV_FILE}`);
    fs.writeFileSync(ENV_FILE, '');
  }

  // Read, update, and write
  let content = readEnvFile();
  content = updateEnvKey(content, KEY_NAME, falKey);
  writeEnvFile(content);

  log.success(`${KEY_NAME} configured in ${ENV_FILE}`);
  console.log(`\n${colors.blue}Next steps:${colors.reset}`);
  console.log('1. Restart your dev server (npm run dev)');
  console.log('2. Go through verification and upload a photo');
  console.log('3. Click "Enhance with AI" on the profile page\n');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
