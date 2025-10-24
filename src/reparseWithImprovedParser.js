import { promises as fs } from 'fs';
import path from 'path';
import { CSVWriter } from './csvWriter.js';
import { ImprovedPDFParser } from './improvedPdfParser.js';

/**
 * Re-parse existing valid PDFs with improved parser
 * Generates high-quality emissions data
 */
async function reparseExistingPDFs() {
  console.log('\n🔄 RE-PARSING EXISTING PDFS WITH IMPROVED PARSER\n');
  console.log('='.repeat(70));

  const downloadsDir = 'downloads';
  const outputFile = 'output/emissions_data_improved.csv';

  // Get all PDF files from downloads directory
  console.log(`\n📂 Scanning ${downloadsDir} directory...`);
  const files = await fs.readdir(downloadsDir);
  const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));

  console.log(`   Found ${pdfFiles.length} PDF files\n`);

  // Create file objects for parser
  const fileObjects = pdfFiles.map(filename => ({
    filename: filename,
    filepath: path.join(downloadsDir, filename),
    sourcePage: inferSourceFromFilename(filename)
  }));

  // Parse all PDFs with improved parser
  const parser = new ImprovedPDFParser();
  const records = await parser.parseAllPDFs(fileObjects);

  // Write to new CSV file
  console.log(`\n💾 Writing ${records.length} records to ${outputFile}...`);
  const csvWriter = new CSVWriter(outputFile);
  await csvWriter.writeRecords(records);

  // Generate summary report
  console.log('\n' + '='.repeat(70));
  console.log('📊 RE-PARSE SUMMARY REPORT');
  console.log('='.repeat(70));
  console.log(`\n✅ RESULTS:`);
  console.log(`   • PDFs processed: ${pdfFiles.length}`);
  console.log(`   • Valid records extracted: ${records.length}`);
  console.log(`   • Output file: ${outputFile}`);

  // Analyze by company
  const byCompany = analyzeByCompany(records);
  console.log(`\n📈 RECORDS BY COMPANY:`);
  Object.entries(byCompany)
    .sort((a, b) => b[1] - a[1])
    .forEach(([company, count]) => {
      console.log(`   • ${company}: ${count} records`);
    });

  // Analyze by scope
  const byScope = analyzeByScope(records);
  console.log(`\n🎯 RECORDS BY SCOPE:`);
  Object.entries(byScope)
    .sort((a, b) => b[1] - a[1])
    .forEach(([scope, count]) => {
      console.log(`   • ${scope}: ${count} records`);
    });

  // Analyze by year
  const byYear = analyzeByYear(records);
  console.log(`\n📅 RECORDS BY YEAR:`);
  Object.entries(byYear)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([year, count]) => {
      console.log(`   • ${year}: ${count} records`);
    });

  // Quality metrics
  console.log(`\n✨ DATA QUALITY:`);
  const withUnit = records.filter(r => r.unit !== 'Unknown').length;
  const withScope = records.filter(r => r.scope !== 'Unknown').length;
  const withYear = records.filter(r => r.year !== 'Unknown').length;
  console.log(`   • Records with unit: ${withUnit} (${(withUnit/records.length*100).toFixed(1)}%)`);
  console.log(`   • Records with scope: ${withScope} (${(withScope/records.length*100).toFixed(1)}%)`);
  console.log(`   • Records with year: ${withYear} (${(withYear/records.length*100).toFixed(1)}%)`);

  console.log('\n' + '='.repeat(70));
  console.log(`\n✅ SUCCESS! Improved emissions data saved to: ${outputFile}\n`);

  return records;
}

/**
 * Infer source website from filename
 */
function inferSourceFromFilename(filename) {
  const lower = filename.toLowerCase();

  if (lower.includes('stg_sr24') || lower.includes('tadawul')) {
    return 'https://www.saudiexchange.sa';
  }
  if (lower.includes('cb-annual') || lower.includes('nasdaq') && lower.includes('dubai')) {
    return 'https://www.nasdaqdubai.com';
  }
  if (lower.includes('lseg')) {
    return 'https://www.lseg.com';
  }
  if (lower.includes('pwc') || lower.includes('esg-report')) {
    return 'https://www.pwc.com';
  }
  if (lower.includes('contact') && lower.includes('egypt')) {
    return 'https://www.te.eg';
  }
  if (lower.includes('abn') || lower.includes('amro')) {
    return 'https://www.abnamro.com';
  }
  if (lower.includes('albert') || lower.includes('heijn')) {
    return 'https://www.ah.nl';
  }
  if (lower.includes('apple')) {
    return 'https://www.apple.com';
  }

  return 'https://sustainability-reports.com';
}

/**
 * Analyze records by company
 */
function analyzeByCompany(records) {
  const counts = {};
  records.forEach(r => {
    counts[r.company] = (counts[r.company] || 0) + 1;
  });
  return counts;
}

/**
 * Analyze records by scope
 */
function analyzeByScope(records) {
  const counts = {};
  records.forEach(r => {
    counts[r.scope] = (counts[r.scope] || 0) + 1;
  });
  return counts;
}

/**
 * Analyze records by year
 */
function analyzeByYear(records) {
  const counts = {};
  records.forEach(r => {
    if (r.year !== 'Unknown') {
      counts[r.year] = (counts[r.year] || 0) + 1;
    }
  });
  return counts;
}

// Run the re-parse
reparseExistingPDFs().catch(error => {
  console.error('\n❌ ERROR during re-parsing:', error.message);
  console.error(error.stack);
  process.exit(1);
});
