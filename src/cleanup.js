import fs from 'fs/promises';
import path from 'path';
import { advancedConfig } from './advancedConfig.js';
import { PDFValidator } from './pdfValidator.js';

/**
 * Standalone cleanup utility to remove fake PDF files
 */
async function cleanup() {
  console.log('🧹 PDF CLEANUP UTILITY\n');
  console.log('='.repeat(80));
  console.log(`Target directory: ${advancedConfig.pdfOutputDir}`);
  console.log('='.repeat(80) + '\n');

  try {
    // Check if directory exists
    try {
      await fs.access(advancedConfig.pdfOutputDir);
    } catch {
      console.log('❌ Downloads directory does not exist yet.');
      return;
    }

    // Initialize validator
    const validator = new PDFValidator(advancedConfig.pdfValidation);

    // First, do a dry run to show what will be removed
    console.log('🔍 STEP 1: Scanning for fake PDFs (DRY RUN)...\n');
    const scanResults = await validator.scanDirectory(advancedConfig.pdfOutputDir);

    console.log('SCAN RESULTS:');
    console.log('-'.repeat(80));
    console.log(`✅ Valid PDFs: ${scanResults.valid.length}`);
    console.log(`❌ Invalid PDFs (fake/HTML): ${scanResults.invalid.length}`);
    console.log('-'.repeat(80) + '\n');

    if (scanResults.invalid.length === 0) {
      console.log('✅ No fake PDFs found. Directory is clean!\n');
      return;
    }

    // Show details of invalid files
    console.log('❌ FILES TO BE REMOVED:');
    console.log('-'.repeat(80));
    scanResults.invalid.forEach((result, i) => {
      const fileName = path.basename(result.file);
      const sizeKB = (result.size / 1024).toFixed(2);
      console.log(`  ${i + 1}. ${fileName}`);
      console.log(`     Size: ${sizeKB} KB | Reason: ${result.reason}`);
    });
    console.log('-'.repeat(80) + '\n');

    // Calculate space to be freed
    const totalSize = scanResults.invalid.reduce((sum, r) => sum + r.size, 0);
    const totalMB = (totalSize / 1024 / 1024).toFixed(2);
    console.log(`💾 Space to be freed: ${totalMB} MB\n`);

    // Perform actual cleanup
    console.log('🗑️  STEP 2: Removing fake PDFs...\n');
    const cleanupResults = await validator.cleanupFakePDFs(
      advancedConfig.pdfOutputDir,
      false // Set to false to actually delete
    );

    console.log('✅ CLEANUP COMPLETED!\n');
    console.log('='.repeat(80));
    console.log('FINAL SUMMARY:');
    console.log('='.repeat(80));
    console.log(`  • Files removed: ${cleanupResults.invalid.length}`);
    console.log(`  • Valid PDFs remaining: ${cleanupResults.valid.length}`);
    console.log(`  • Space freed: ${totalMB} MB`);
    console.log('='.repeat(80) + '\n');

    // Show remaining valid files
    if (cleanupResults.valid.length > 0) {
      console.log('📁 VALID PDFs REMAINING:');
      console.log('-'.repeat(80));
      cleanupResults.valid.forEach((result, i) => {
        const fileName = path.basename(result.file);
        const sizeMB = (result.size / 1024 / 1024).toFixed(2);
        console.log(`  ${i + 1}. ${fileName} (${sizeMB} MB)`);
      });
      console.log('-'.repeat(80) + '\n');
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
  }
}

// Run cleanup
cleanup().catch(console.error);
