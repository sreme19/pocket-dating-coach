#!/usr/bin/env tsx
/**
 * Production Environment Verification Script
 * 
 * This script verifies that all required environment variables are set
 * and that the application can connect to production services.
 * 
 * Usage:
 *   npm run verify:prod-env
 *   tsx --env-file=.env.production scripts/verify-production-env.ts
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

interface VerificationResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
}

const results: VerificationResult[] = [];

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
};

function log(color: string, message: string) {
  console.log(`${color}${message}${colors.reset}`);
}

async function verifyEnvironmentVariables() {
  log(colors.blue, '\n📋 Verifying Environment Variables...\n');

  const requiredVars = [
    { name: 'SUPABASE_URL', description: 'Supabase project URL' },
    { name: 'SUPABASE_SERVICE_KEY', description: 'Supabase service role key' },
    { name: 'ANTHROPIC_API_KEY', description: 'Anthropic Claude API key' },
    { name: 'PUBLIC_SUPABASE_URL', description: 'Public Supabase URL (client-side)' },
    { name: 'PUBLIC_SUPABASE_ANON_KEY', description: 'Public Supabase anonymous key' },
  ];

  for (const variable of requiredVars) {
    const value = process.env[variable.name];
    if (!value) {
      results.push({
        name: variable.name,
        status: 'fail',
        message: `Missing required environment variable: ${variable.name}`,
        details: `Description: ${variable.description}`,
      });
      log(colors.red, `  ❌ ${variable.name} - NOT SET`);
    } else {
      // Mask the value for security
      const masked = value.substring(0, 10) + '...' + value.substring(value.length - 5);
      results.push({
        name: variable.name,
        status: 'pass',
        message: `Environment variable ${variable.name} is set`,
        details: `Value: ${masked}`,
      });
      log(colors.green, `  ✅ ${variable.name} - SET`);
    }
  }

  // Optional variables
  const optionalVars = [
    { name: 'VOYAGE_API_KEY', description: 'Voyage AI API key for embeddings' },
  ];

  for (const variable of optionalVars) {
    const value = process.env[variable.name];
    if (!value) {
      results.push({
        name: variable.name,
        status: 'warning',
        message: `Optional environment variable not set: ${variable.name}`,
        details: `Description: ${variable.description}`,
      });
      log(colors.yellow, `  ⚠️  ${variable.name} - NOT SET (optional)`);
    } else {
      const masked = value.substring(0, 10) + '...' + value.substring(value.length - 5);
      results.push({
        name: variable.name,
        status: 'pass',
        message: `Optional environment variable ${variable.name} is set`,
        details: `Value: ${masked}`,
      });
      log(colors.green, `  ✅ ${variable.name} - SET`);
    }
  }
}

async function verifySupabaseConnectivity() {
  log(colors.blue, '\n🗄️  Verifying Supabase Connectivity...\n');

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      results.push({
        name: 'Supabase Connection',
        status: 'fail',
        message: 'Cannot verify Supabase connectivity - missing credentials',
      });
      log(colors.red, '  ❌ Supabase credentials missing');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Test basic connectivity by querying auth.users
    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) {
      results.push({
        name: 'Supabase Connection',
        status: 'fail',
        message: `Failed to connect to Supabase: ${error.message}`,
        details: `Error: ${JSON.stringify(error)}`,
      });
      log(colors.red, `  ❌ Supabase connection failed: ${error.message}`);
    } else {
      results.push({
        name: 'Supabase Connection',
        status: 'pass',
        message: 'Successfully connected to Supabase',
        details: `Found ${data?.users?.length || 0} users in database`,
      });
      log(colors.green, `  ✅ Supabase connection successful`);
      log(colors.green, `     Users in database: ${data?.users?.length || 0}`);
    }

    // Verify required tables exist
    const tables = [
      'ai_assistant_profiles',
      'ai_assistant_conversations',
      'ai_assistant_summaries',
      'ai_assistant_configs',
    ];

    log(colors.blue, '\n  Checking required tables...\n');

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('count()', { count: 'exact', head: true });

      if (error) {
        results.push({
          name: `Table: ${table}`,
          status: 'warning',
          message: `Table ${table} may not exist or is not accessible`,
          details: `Error: ${error.message}`,
        });
        log(colors.yellow, `    ⚠️  ${table} - NOT FOUND or NOT ACCESSIBLE`);
      } else {
        results.push({
          name: `Table: ${table}`,
          status: 'pass',
          message: `Table ${table} exists and is accessible`,
        });
        log(colors.green, `    ✅ ${table} - EXISTS`);
      }
    }
  } catch (error) {
    results.push({
      name: 'Supabase Connection',
      status: 'fail',
      message: `Unexpected error during Supabase verification: ${error instanceof Error ? error.message : String(error)}`,
    });
    log(colors.red, `  ❌ Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function verifyClaudeConnectivity() {
  log(colors.blue, '\n🤖 Verifying Claude API Connectivity...\n');

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      results.push({
        name: 'Claude API Connection',
        status: 'fail',
        message: 'Cannot verify Claude API connectivity - missing API key',
      });
      log(colors.red, '  ❌ Claude API key missing');
      return;
    }

    const client = new Anthropic({ apiKey });

    // Try multiple models in order of preference
    const models = [
      'claude-3-5-sonnet-20241022',
      'claude-3-sonnet-20240229',
      'claude-opus-4-1-20250805',
      'claude-3-opus-20250219',
    ];

    let success = false;
    let lastError: string | null = null;

    for (const model of models) {
      try {
        const message = await client.messages.create({
          model,
          max_tokens: 100,
          messages: [
            {
              role: 'user',
              content: 'Say "Production environment verified" in exactly 5 words.',
            },
          ],
        });

        if (message.content && message.content.length > 0) {
          results.push({
            name: 'Claude API Connection',
            status: 'pass',
            message: 'Successfully connected to Claude API',
            details: `Model: ${message.model}, Stop reason: ${message.stop_reason}`,
          });
          log(colors.green, `  ✅ Claude API connection successful`);
          log(colors.green, `     Model: ${message.model}`);
          log(colors.green, `     Response: ${(message.content[0] as any).text}`);
          success = true;
          break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        // Try next model
        continue;
      }
    }

    if (!success) {
      results.push({
        name: 'Claude API Connection',
        status: 'fail',
        message: `Failed to connect to Claude API with available models`,
        details: `Last error: ${lastError}`,
      });
      log(colors.red, `  ❌ Claude API connection failed: ${lastError}`);
    }
  } catch (error) {
    results.push({
      name: 'Claude API Connection',
      status: 'fail',
      message: `Failed to connect to Claude API: ${error instanceof Error ? error.message : String(error)}`,
    });
    log(colors.red, `  ❌ Claude API connection failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function generateReport() {
  log(colors.blue, '\n📊 Verification Report\n');

  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const warnings = results.filter((r) => r.status === 'warning').length;

  log(colors.bold, `Total Checks: ${results.length}`);
  log(colors.green, `Passed: ${passed}`);
  log(colors.yellow, `Warnings: ${warnings}`);
  log(colors.red, `Failed: ${failed}`);

  if (failed > 0) {
    log(colors.red, '\n❌ VERIFICATION FAILED\n');
    log(colors.red, 'Failed checks:');
    results
      .filter((r) => r.status === 'fail')
      .forEach((r) => {
        log(colors.red, `  - ${r.name}: ${r.message}`);
        if (r.details) {
          log(colors.red, `    ${r.details}`);
        }
      });
    process.exit(1);
  } else if (warnings > 0) {
    log(colors.yellow, '\n⚠️  VERIFICATION PASSED WITH WARNINGS\n');
    log(colors.yellow, 'Warnings:');
    results
      .filter((r) => r.status === 'warning')
      .forEach((r) => {
        log(colors.yellow, `  - ${r.name}: ${r.message}`);
        if (r.details) {
          log(colors.yellow, `    ${r.details}`);
        }
      });
  } else {
    log(colors.green, '\n✅ ALL VERIFICATIONS PASSED\n');
  }

  // Save report to file
  const reportPath = './production-env-verification-report.json';
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed,
      warnings,
      failed,
    },
    results,
  };

  try {
    const fs = await import('fs').then((m) => m.promises);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    log(colors.blue, `\n📄 Report saved to: ${reportPath}`);
  } catch (error) {
    log(colors.yellow, `\n⚠️  Could not save report: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  log(colors.bold, '\n🚀 Production Environment Verification\n');
  log(colors.blue, `Timestamp: ${new Date().toISOString()}\n`);

  await verifyEnvironmentVariables();
  await verifySupabaseConnectivity();
  await verifyClaudeConnectivity();
  await generateReport();
}

main().catch((error) => {
  log(colors.red, `\n❌ Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
