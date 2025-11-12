#!/usr/bin/env node

/**
 * 🚀 MASTER ORCHESTRATION PIPELINE
 *
 * This script orchestrates the entire emissions data processing workflow.
 * 1. Runs the comprehensive PDF extraction pipeline.
 * 2. Runs the final dataset merger to produce the professional dataset.
 *
 * USAGE:
 *   node master_pipeline.js
 */

import { spawn } from 'child_process';

async function runCommand(command, description) {
  console.log(`\n🚀 Starting: ${description}`);
  console.log(`   Executing: ${command}`);
  console.log('------------------------------------------------------------');

  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(' ');
    const child = spawn(cmd, args, { shell: true, stdio: 'pipe' });

    child.stdout.on('data', (data) => {
      console.log(data.toString());
    });

    child.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Success: ${description} completed.`);
        resolve(true);
      } else {
        console.error(`❌ Error: ${description} exited with code ${code}`);
        resolve(false);
      }
    });

    child.on('error', (error) => {
      console.error(`❌ Error spawning process for ${description}:`, error);
      reject(error);
    });
  });
}

async function main() {
  console.log('🚀 MASTER PIPELINE STARTED 🚀');
  console.log('============================================================');

  // Step 1: Run the comprehensive PDF extraction
  const extractionSuccess = await runCommand(
    'node pipeline.js --skip-scraping',
    'Comprehensive PDF Data Extraction'
  );

  if (!extractionSuccess) {
    console.error('❌ Master pipeline failed at data extraction. Aborting.');
    process.exit(1);
  }

  // Step 2: Run the final dataset merger
  const mergerSuccess = await runCommand(
    'node final_dataset_merger.js',
    'Final Dataset Merging and Formatting'
  );

  if (!mergerSuccess) {
    console.error('❌ Master pipeline failed at dataset merging. Aborting.');
    process.exit(1);
  }

  console.log('\n🎉 MASTER PIPELINE COMPLETED SUCCESSFULLY! 🎉');
  console.log('============================================================');
  console.log('Final dataset is ready at: output/final_comprehensive_emissions_dataset.csv');
}

main();
