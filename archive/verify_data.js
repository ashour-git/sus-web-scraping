#!/usr/bin/env node

/**
 * Data Verification Script
 *
 * This script helps your team verify the accuracy of extracted emission data
 * by comparing random samples against their source PDFs.
 *
 * Usage:
 *   node verify_data.js [--count 10]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command-line arguments
const args = process.argv.slice(2);
const sampleCount = args.includes('--count')
  ? parseInt(args[args.indexOf('--count') + 1])
  : 5;

// Paths
const CSV_PATH = path.join(__dirname, 'output', 'emissions_data_SIMPLE.csv');
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
 * Parse CSV file
 */
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  if (lines.length < 2) {
    throw new Error('CSV file is empty or invalid');
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const record = {};

    headers.forEach((header, index) => {
      record[header] = values[index] ? values[index].trim() : '';
    });

    records.push(record);
  }

  return records;
}

/**
 * Get random sample of records
 */
function getRandomSample(records, count) {
  const shuffled = [...records].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

/**
 * Display verification instructions
 */
function displayVerificationInstructions(sample) {
  console.log('\n' + '='.repeat(70));
  log('DATA VERIFICATION TEST', 'cyan');
  console.log('='.repeat(70));

  log(`\nSelected ${sample.length} random records for verification:`, 'yellow');
  log('Follow the instructions below to verify each record.\n', 'gray');

  sample.forEach((record, index) => {
    console.log('\n' + '-'.repeat(70));
    log(`RECORD ${index + 1}/${sample.length}`, 'cyan');
    console.log('-'.repeat(70));

    log(`\n📊 EXTRACTED DATA:`, 'yellow');
    console.log(`   Company:       ${record.company_name}`);
    console.log(`   Year:          ${record.year}`);
    console.log(`   Scope:         ${record.scope}`);
    console.log(`   Value:         ${record.value}`);
    console.log(`   Unit:          ${record.unit}`);
    console.log(`   Confidence:    ${record.confidence_score}`);
    console.log(`   Source:        ${record.source_file}`);

    log(`\n✅ VERIFICATION STEPS:`, 'green');
    console.log(`   1. Open PDF: downloads/${record.source_file}`);
    console.log(`   2. Press Ctrl+F (or Cmd+F on Mac)`);
    console.log(`   3. Search for: "${record.value}"`);
    console.log(`   4. Verify the following:`);
    console.log(`      • Is the value ${record.value} present in the PDF?`);
    console.log(`      • Is it associated with ${record.scope}?`);
    console.log(`      • Is it for year ${record.year}?`);
    console.log(`      • Is the unit ${record.unit} or similar?`);

    // Check if PDF exists
    const pdfPath = path.join(PDF_DIR, record.source_file);
    if (fs.existsSync(pdfPath)) {
      log(`\n   ✓ PDF found: ${pdfPath}`, 'green');
    } else {
      log(`\n   ✗ PDF not found: ${pdfPath}`, 'red');
      log(`     (This PDF might be in a different location)`, 'gray');
    }

    log(`\n📝 MARK YOUR RESULT:`, 'yellow');
    console.log(`   [ ] CORRECT - Data matches PDF`);
    console.log(`   [ ] INCORRECT - Data does not match PDF`);
    console.log(`   [ ] PARTIAL - Some fields match, others don't`);
    console.log(`   [ ] CANNOT VERIFY - PDF not available or unclear`);
  });

  // Summary section
  console.log('\n' + '='.repeat(70));
  log('VERIFICATION SUMMARY', 'cyan');
  console.log('='.repeat(70));

  log(`\nTotal records to verify: ${sample.length}`, 'yellow');

  console.log(`\n✓ CORRECT:        ___ / ${sample.length}`);
  console.log(`✗ INCORRECT:      ___ / ${sample.length}`);
  console.log(`≈ PARTIAL:        ___ / ${sample.length}`);
  console.log(`? CANNOT VERIFY:  ___ / ${sample.length}`);

  console.log(`\nAccuracy Rate: ____%`);

  log(`\n💡 TIP: For production use, aim for 95%+ accuracy on high-confidence records (≥0.9)`, 'cyan');

  // Expected results
  console.log('\n' + '='.repeat(70));
  log('EXPECTED RESULTS', 'green');
  console.log('='.repeat(70));

  log(`\nFor records with confidence ≥ 0.9:`, 'yellow');
  console.log(`   • Expected accuracy: 95-100%`);
  console.log(`   • Most values should match PDFs exactly`);
  console.log(`   • Company names should be correct`);
  console.log(`   • Years should be reasonable (2015-2025)`);

  log(`\nFor records with confidence 0.7-0.9:`, 'yellow');
  console.log(`   • Expected accuracy: 80-95%`);
  console.log(`   • Some fields might be approximate`);
  console.log(`   • May need manual verification for critical use`);

  log(`\nFor records with confidence < 0.7:`, 'yellow');
  console.log(`   • Expected accuracy: 60-80%`);
  console.log(`   • Use with caution`);
  console.log(`   • Recommend manual review before using`);

  console.log('\n' + '='.repeat(70));
}

/**
 * Generate statistics
 */
function displayStatistics(records) {
  console.log('\n' + '='.repeat(70));
  log('DATA STATISTICS', 'cyan');
  console.log('='.repeat(70));

  const total = records.length;
  const highConfidence = records.filter(r => parseFloat(r.confidence_score) >= 0.9).length;
  const mediumConfidence = records.filter(r => {
    const score = parseFloat(r.confidence_score);
    return score >= 0.7 && score < 0.9;
  }).length;
  const lowConfidence = records.filter(r => parseFloat(r.confidence_score) < 0.7).length;

  const companies = new Set(records.map(r => r.company_name)).size;
  const years = new Set(records.map(r => r.year)).size;
  const scopes = new Set(records.map(r => r.scope)).size;

  log(`\nTotal Records: ${total}`, 'yellow');

  console.log(`\nQuality Distribution:`);
  console.log(`   High (≥0.9):    ${highConfidence} (${(highConfidence/total*100).toFixed(1)}%)`);
  console.log(`   Medium (0.7-0.9): ${mediumConfidence} (${(mediumConfidence/total*100).toFixed(1)}%)`);
  console.log(`   Low (<0.7):     ${lowConfidence} (${(lowConfidence/total*100).toFixed(1)}%)`);

  console.log(`\nData Coverage:`);
  console.log(`   Unique Companies: ${companies}`);
  console.log(`   Year Range:       ${years} years`);
  console.log(`   Scope Types:      ${scopes}`);

  console.log('\n' + '='.repeat(70));
}

/**
 * Main function
 */
async function main() {
  try {
    // Display header
    console.log('\n' + '╔' + '═'.repeat(68) + '╗');
    log('║' + ' '.repeat(15) + 'EMISSION DATA VERIFICATION TOOL' + ' '.repeat(22) + '║', 'cyan');
    console.log('╚' + '═'.repeat(68) + '╝');

    log('\nThis tool helps verify the accuracy of extracted emission data.', 'gray');
    log('It selects random samples for manual verification against PDFs.\n', 'gray');

    // Check if CSV exists
    if (!fs.existsSync(CSV_PATH)) {
      log(`\n✗ CSV file not found: ${CSV_PATH}`, 'red');
      log(`  Run 'npm start' first to generate data.\n`, 'yellow');
      process.exit(1);
    }

    // Load data
    log(`📂 Loading data from: ${path.basename(CSV_PATH)}`, 'cyan');
    const records = parseCSV(CSV_PATH);
    log(`✓ Loaded ${records.length} records`, 'green');

    // Filter high-confidence records for better testing
    const highConfidenceRecords = records.filter(r => parseFloat(r.confidence_score) >= 0.9);

    if (highConfidenceRecords.length === 0) {
      log('\n⚠️  No high-confidence records found. Using all records.', 'yellow');
    } else {
      log(`✓ Found ${highConfidenceRecords.length} high-confidence records (≥0.9)`, 'green');
    }

    // Select sample
    const samplePool = highConfidenceRecords.length > 0 ? highConfidenceRecords : records;
    const actualCount = Math.min(sampleCount, samplePool.length);
    const sample = getRandomSample(samplePool, actualCount);

    log(`✓ Selected ${actualCount} random records for verification\n`, 'green');

    // Display statistics
    displayStatistics(records);

    // Display verification instructions
    displayVerificationInstructions(sample);

    // Save sample to file
    const sampleCSV = sample.map(r =>
      `${r.company_name},${r.year},${r.scope},${r.value},${r.unit},${r.source_file},${r.confidence_score}`
    ).join('\n');

    const sampleFile = path.join(__dirname, 'verification_sample.csv');
    fs.writeFileSync(
      sampleFile,
      'company_name,year,scope,value,unit,source_file,confidence_score\n' + sampleCSV
    );

    log(`\n💾 Sample saved to: verification_sample.csv`, 'cyan');
    log(`   (You can import this into Excel for easier tracking)\n`, 'gray');

    // Instructions for team
    console.log('='.repeat(70));
    log('INSTRUCTIONS FOR TEAM', 'cyan');
    console.log('='.repeat(70));

    console.log(`
1. Go through each record above
2. Open the source PDF
3. Search for the value in the PDF (Ctrl+F)
4. Mark whether data is CORRECT, INCORRECT, PARTIAL, or CANNOT VERIFY
5. Calculate accuracy rate: (CORRECT / TOTAL) × 100%

Target Accuracy:
• High-confidence records (≥0.9): 95-100% accuracy
• Medium-confidence (0.7-0.9):   80-95% accuracy
• Low-confidence (<0.7):         60-80% accuracy

Questions?
• See HOW_IT_WORKS.md for detailed extraction methodology
• See README.md for usage examples
• Check pipeline_report.json for quality metrics
`);

    log('Happy verifying! 🔍\n', 'green');

  } catch (error) {
    log(`\n✗ Error: ${error.message}`, 'red');
    log(`\nStack trace:`, 'gray');
    console.log(error.stack);
    process.exit(1);
  }
}

// Run
main();
