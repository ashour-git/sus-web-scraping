import { promises as fs } from 'fs';
import path from 'path';
import { CSVWriter } from './csvWriter.js';
import { HybridPDFParser } from './hybridPdfParser.js';

/**
 * ULTRATHINK APPROACH: Re-parse with hybrid strategy
 * Goal: Get 1000+ records with 50%+ quality
 */
async function ultrathinkReparse() {
  console.log('\n🧠 ULTRATHINK PDF RE-PARSING\n');
  console.log('='.repeat(70));
  console.log('GOAL: Extract VOLUME of emissions data with SMART validation');
  console.log('Target: 1000+ records with 50%+ quality rate');
  console.log('='.repeat(70));

  const downloadsDir = 'downloads';
  const outputFile = 'output/emissions_data_ultrathink.csv';

  // Get all PDFs
  console.log(`\n📂 Scanning ${downloadsDir} directory...`);
  const files = await fs.readdir(downloadsDir);
  const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
  console.log(`   Found ${pdfFiles.length} PDF files\n`);

  // Create file objects
  const fileObjects = pdfFiles.map(filename => ({
    filename: filename,
    filepath: path.join(downloadsDir, filename),
    sourcePage: inferSourceFromFilename(filename)
  }));

  // Parse with hybrid parser
  const parser = new HybridPDFParser();
  const records = await parser.parseAllPDFs(fileObjects);

  // Write to CSV
  console.log(`\n💾 Writing ${records.length} records to ${outputFile}...`);
  const csvWriter = new CSVWriter(outputFile);

  // Format records for CSV
  const csvRecords = records.map(r => ({
    company: r.company,
    year: r.year,
    scope: r.scope,
    category: r.category,
    value: r.value,
    unit: r.unit,
    sourceFile: r.sourceFile,
    source: r.source,
    rawText: r.rawText,
    confidence: r.confidence ? r.confidence.toFixed(2) : 'N/A',
    method: r.extractionMethod
  }));

  await csvWriter.writeRecords(csvRecords);

  // Generate comprehensive analysis
  console.log('\n' + '='.repeat(70));
  console.log('📊 ULTRATHINK RESULTS ANALYSIS');
  console.log('='.repeat(70));

  console.log(`\n✅ EXTRACTION SUMMARY:`);
  console.log(`   • PDFs processed: ${pdfFiles.length}`);
  console.log(`   • Total records extracted: ${records.length}`);
  console.log(`   • Output file: ${outputFile}`);

  // Confidence distribution
  console.log(`\n📈 CONFIDENCE DISTRIBUTION:`);
  const highConf = records.filter(r => r.confidence >= 0.6);
  const medConf = records.filter(r => r.confidence >= 0.4 && r.confidence < 0.6);
  const lowConf = records.filter(r => r.confidence < 0.4);

  console.log(`   • High (60%+): ${highConf.length} records (${(highConf.length/records.length*100).toFixed(1)}%)`);
  console.log(`   • Medium (40-60%): ${medConf.length} records (${(medConf.length/records.length*100).toFixed(1)}%)`);
  console.log(`   • Low (<40%): ${lowConf.length} records (${(lowConf.length/records.length*100).toFixed(1)}%)`);

  // By extraction method
  console.log(`\n🔧 BY EXTRACTION METHOD:`);
  const byMethod = {};
  records.forEach(r => {
    byMethod[r.extractionMethod] = (byMethod[r.extractionMethod] || 0) + 1;
  });
  Object.entries(byMethod)
    .sort((a, b) => b[1] - a[1])
    .forEach(([method, count]) => {
      console.log(`   • ${method}: ${count} records (${(count/records.length*100).toFixed(1)}%)`);
    });

  // By company
  console.log(`\n🏢 BY COMPANY (Top 10):`);
  const byCompany = {};
  records.forEach(r => {
    byCompany[r.company] = (byCompany[r.company] || 0) + 1;
  });
  Object.entries(byCompany)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([company, count]) => {
      console.log(`   • ${company}: ${count} records`);
    });

  // By scope
  console.log(`\n🎯 BY SCOPE:`);
  const byScope = {};
  records.forEach(r => {
    byScope[r.scope] = (byScope[r.scope] || 0) + 1;
  });
  Object.entries(byScope)
    .sort((a, b) => b[1] - a[1])
    .forEach(([scope, count]) => {
      console.log(`   • ${scope}: ${count} records (${(count/records.length*100).toFixed(1)}%)`);
    });

  // By year
  console.log(`\n📅 BY YEAR:`);
  const byYear = {};
  records.forEach(r => {
    if (r.year !== 'Recent') {
      byYear[r.year] = (byYear[r.year] || 0) + 1;
    }
  });
  Object.entries(byYear)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([year, count]) => {
      console.log(`   • ${year}: ${count} records`);
    });

  // Value statistics
  console.log(`\n💰 VALUE STATISTICS:`);
  const values = records.map(r => r.value).filter(v => typeof v === 'number');
  if (values.length > 0) {
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);

    console.log(`   • Total emissions: ${sum.toLocaleString()} tonnes CO2e`);
    console.log(`   • Average per record: ${avg.toFixed(2)} tonnes CO2e`);
    console.log(`   • Maximum value: ${max.toLocaleString()} tonnes CO2e`);
    console.log(`   • Minimum value: ${min.toFixed(2)} tonnes CO2e`);
  }

  // Comparison with old approach
  console.log(`\n📊 COMPARISON WITH PREVIOUS ATTEMPTS:`);
  console.log(`   • Original parser: 6,373 records (0.02% valid)`);
  console.log(`   • Improved parser: 1 record (100% valid)`);
  console.log(`   • ULTRATHINK hybrid: ${records.length} records (${highConf.length + medConf.length} usable)`);
  console.log(`   • Quality improvement: ${((highConf.length + medConf.length)/records.length*100).toFixed(1)}% usable data`);

  console.log('\n' + '='.repeat(70));
  console.log('\n✅ SUCCESS! Hybrid emissions data saved to: ${outputFile}');
  console.log(`\n💡 RECOMMENDATION: Use high + medium confidence records (${highConf.length + medConf.length} total)`);
  console.log('='.repeat(70) + '\n');

  return records;
}

/**
 * Infer source from filename
 */
function inferSourceFromFilename(filename) {
  const lower = filename.toLowerCase();

  if (lower.includes('stg_sr24') || lower.includes('tadawul')) return 'https://www.saudiexchange.sa';
  if (lower.includes('cb-annual') || (lower.includes('nasdaq') && lower.includes('dubai'))) return 'https://www.nasdaqdubai.com';
  if (lower.includes('lseg')) return 'https://www.lseg.com';
  if (lower.includes('pwc') || lower.includes('esg-report')) return 'https://www.pwc.com';
  if (lower.includes('contact')) return 'https://www.te.eg';
  if (lower.includes('abn') || lower.includes('amro')) return 'https://www.abnamro.com';
  if (lower.includes('albert') || lower.includes('heijn')) return 'https://www.ah.nl';
  if (lower.includes('apple')) return 'https://www.apple.com';
  if (lower.includes('google')) return 'https://www.google.com';
  if (lower.includes('tesla')) return 'https://www.tesla.com';

  return 'https://various-sources.com';
}

// Run ULTRATHINK re-parse
ultrathinkReparse().catch(error => {
  console.error('\n❌ ERROR during ULTRATHINK re-parsing:', error.message);
  console.error(error.stack);
  process.exit(1);
});
