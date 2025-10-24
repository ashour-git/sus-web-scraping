/**
 * Quick Start Script
 * Runs the complete enhanced scraping workflow
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const steps = [
  {
    name: 'Cleanup Fake PDFs',
    script: 'cleanup.js',
    description: 'Removing fake HTML files from previous run...'
  },
  {
    name: 'Ultra-Advanced Scraper',
    script: 'advancedScraper.js',
    description: 'Scraping failed websites with advanced techniques...'
  },
  {
    name: 'Final Verification',
    script: 'finalVerification.js',
    description: 'Generating comprehensive verification report...'
  }
];

async function runStep(step) {
  return new Promise((resolve, reject) => {
    console.log('\n' + '='.repeat(80));
    console.log(`🚀 ${step.name}`);
    console.log('='.repeat(80));
    console.log(step.description);
    console.log('');

    const scriptPath = path.join(__dirname, step.script);
    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${step.name} completed successfully\n`);
        resolve();
      } else {
        console.error(`\n❌ ${step.name} failed with code ${code}\n`);
        reject(new Error(`${step.name} failed`));
      }
    });

    child.on('error', (err) => {
      console.error(`\n❌ Error running ${step.name}:`, err.message);
      reject(err);
    });
  });
}

async function main() {
  console.log('\n🌱 EMISSIONS SCRAPER - COMPLETE WORKFLOW');
  console.log('='.repeat(80));
  console.log('This will run the complete enhanced scraping workflow:');
  console.log('  1. Cleanup fake PDFs');
  console.log('  2. Run ultra-advanced scraper on failed websites');
  console.log('  3. Generate final verification report');
  console.log('='.repeat(80) + '\n');

  const startTime = Date.now();

  try {
    for (const step of steps) {
      await runStep(step);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(80));
    console.log('🎉 COMPLETE WORKFLOW FINISHED SUCCESSFULLY!');
    console.log('='.repeat(80));
    console.log(`Total time: ${duration} seconds`);
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Workflow failed:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
