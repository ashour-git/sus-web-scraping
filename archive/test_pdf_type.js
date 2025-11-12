#!/usr/bin/env node

/**
 * PDF Type Tester
 *
 * Tests if PDFs are text-based or image-based (need OCR)
 *
 * Usage: node test_pdf_type.js
 */

import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PDF_DIR = path.join(__dirname, 'downloads');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

/**
 * Test if PDF is text-based or image-based
 */
async function testPDF(pdfPath) {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);

    const textLength = data.text.trim().length;
    const numPages = data.numpages;
    const avgTextPerPage = textLength / numPages;

    // Heuristic: if less than 100 chars per page, likely image-based
    const needsOCR = avgTextPerPage < 100;

    return {
      filename: path.basename(pdfPath),
      pages: numPages,
      textLength: textLength,
      avgPerPage: Math.round(avgTextPerPage),
      needsOCR: needsOCR,
      type: needsOCR ? 'IMAGE-BASED (needs OCR)' : 'TEXT-BASED (OK)',
      status: needsOCR ? 'red' : 'green'
    };
  } catch (error) {
    return {
      filename: path.basename(pdfPath),
      error: error.message,
      needsOCR: true,
      type: 'ERROR (try OCR)',
      status: 'yellow'
    };
  }
}

/**
 * Main function
 */
async function main() {
  console.log('\n' + '╔' + '═'.repeat(78) + '╗');
  log('║' + ' '.repeat(25) + 'PDF TYPE ANALYZER' + ' '.repeat(36) + '║', 'cyan');
  console.log('╚' + '═'.repeat(78) + '╝\n');

  log('Testing PDFs to determine if they need OCR...', 'gray');
  log('Text-based PDFs: Use pdf-parse (fast)', 'gray');
  log('Image-based PDFs: Need OCR (slower)\n', 'gray');

  // Get all PDFs
  if (!fs.existsSync(PDF_DIR)) {
    log(`\n✗ Directory not found: ${PDF_DIR}`, 'red');
    log('  Create downloads/ folder and add PDF files.\n', 'yellow');
    process.exit(1);
  }

  const files = fs.readdirSync(PDF_DIR)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => path.join(PDF_DIR, f));

  if (files.length === 0) {
    log('\n✗ No PDF files found in downloads/ folder\n', 'red');
    process.exit(1);
  }

  log(`📂 Found ${files.length} PDF files\n`, 'cyan');

  // Test each PDF
  const results = [];
  let processed = 0;

  for (const file of files) {
    processed++;
    process.stdout.write(`\rTesting ${processed}/${files.length}...`);
    const result = await testPDF(file);
    results.push(result);
  }

  console.log('\n');

  // Display results
  console.log('='.repeat(80));
  log('TEST RESULTS', 'cyan');
  console.log('='.repeat(80));
  console.log('');

  // Summary stats
  const textBased = results.filter(r => !r.needsOCR).length;
  const imageBased = results.filter(r => r.needsOCR).length;
  const errors = results.filter(r => r.error).length;

  log(`Total PDFs: ${results.length}`, 'yellow');
  log(`✓ Text-based (no OCR needed): ${textBased} (${(textBased/results.length*100).toFixed(1)}%)`, 'green');
  log(`✗ Image-based (needs OCR): ${imageBased} (${(imageBased/results.length*100).toFixed(1)}%)`, 'red');
  if (errors > 0) {
    log(`⚠ Errors: ${errors}`, 'yellow');
  }

  console.log('\n' + '='.repeat(80));
  log('DETAILED RESULTS', 'cyan');
  console.log('='.repeat(80));
  console.log('');

  // Group by type
  const textBasedPDFs = results.filter(r => !r.needsOCR && !r.error);
  const imageBasedPDFs = results.filter(r => r.needsOCR && !r.error);
  const errorPDFs = results.filter(r => r.error);

  if (textBasedPDFs.length > 0) {
    log('\n✓ TEXT-BASED PDFs (pdf-parse works fine):', 'green');
    console.log('-'.repeat(80));
    textBasedPDFs.forEach(r => {
      console.log(`  ${r.filename}`);
      console.log(`    Pages: ${r.pages} | Text: ${r.textLength} chars | Avg: ${r.avgPerPage} chars/page`);
    });
  }

  if (imageBasedPDFs.length > 0) {
    log('\n✗ IMAGE-BASED PDFs (need OCR for better results):', 'red');
    console.log('-'.repeat(80));
    imageBasedPDFs.forEach(r => {
      console.log(`  ${r.filename}`);
      console.log(`    Pages: ${r.pages} | Text: ${r.textLength} chars | Avg: ${r.avgPerPage} chars/page`);
    });
  }

  if (errorPDFs.length > 0) {
    log('\n⚠ PDFs WITH ERRORS:', 'yellow');
    console.log('-'.repeat(80));
    errorPDFs.forEach(r => {
      console.log(`  ${r.filename}`);
      console.log(`    Error: ${r.error}`);
    });
  }

  // Recommendations
  console.log('\n' + '='.repeat(80));
  log('RECOMMENDATIONS', 'cyan');
  console.log('='.repeat(80));
  console.log('');

  if (imageBased === 0 && errors === 0) {
    log('✓ All PDFs are text-based!', 'green');
    log('  Current pipeline.js works fine - no OCR needed.', 'green');
    log('  Continue using: npm start', 'gray');
  } else if (imageBased <= 5) {
    log('⚠ Some PDFs are image-based', 'yellow');
    log(`  ${imageBased} PDFs need OCR (${(imageBased/results.length*100).toFixed(1)}% of total)`, 'yellow');
    log('\n  Option 1: Skip image-based PDFs (fastest)', 'gray');
    log('    Current pipeline will skip them automatically', 'gray');
    log('\n  Option 2: Use OCR-enhanced pipeline (slower but complete)', 'gray');
    log('    Run: node extract_with_ocr.js', 'gray');
  } else {
    log('✗ Many PDFs are image-based', 'red');
    log(`  ${imageBased} PDFs need OCR (${(imageBased/results.length*100).toFixed(1)}% of total)`, 'red');
    log('\n  Recommendation: Use OCR-enhanced pipeline', 'yellow');
    log('    Run: node extract_with_ocr.js', 'gray');
    log('    Or use Azure Document Intelligence for best results', 'gray');
  }

  // Save results
  const reportPath = path.join(__dirname, 'output', 'pdf_type_report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      textBased: textBased,
      imageBased: imageBased,
      errors: errors
    },
    results: results
  }, null, 2));

  log(`\n💾 Report saved to: output/pdf_type_report.json`, 'cyan');

  console.log('\n' + '='.repeat(80));
  log('NEXT STEPS', 'cyan');
  console.log('='.repeat(80));
  console.log('');

  if (imageBased > 0) {
    log('To extract from image-based PDFs:', 'yellow');
    log('  1. Install OCR: npm install tesseract.js', 'white');
    log('  2. Run: node extract_with_ocr.js', 'white');
    log('  3. Or use Azure: node extract_with_azure.js', 'white');
  } else {
    log('Your PDFs are ready for extraction:', 'green');
    log('  Run: npm start', 'white');
  }

  console.log('');
}

// Run
main().catch(error => {
  log(`\n✗ Error: ${error.message}`, 'red');
  console.error(error.stack);
  process.exit(1);
});
