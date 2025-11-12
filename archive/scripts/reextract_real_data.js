/**
 * 🔄 RE-EXTRACT REAL DATA FROM PDFs
 *
 * This script re-processes all PDFs with the improved parser to get:
 * ✅ Real company names (from PDF content, not filenames)
 * ✅ Table-based data extraction
 * ✅ Smart deduplication (no noise)
 * ✅ High-quality structured data
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import AdvancedTableParser from './src/advancedTableParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PDF_DIRECTORY = path.join(__dirname, 'downloads');
const OUTPUT_FILE = path.join(__dirname, 'output', 'emissions_data_REAL.csv');
const REPORT_FILE = path.join(__dirname, 'output', 'extraction_quality_report.json');

class RealDataExtractor {
  constructor() {
    this.parser = new AdvancedTableParser();
    this.stats = {
      totalPDFs: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      totalRecords: 0,
      companiesExtracted: new Set(),
      companiesFailed: [],
      byMethod: {
        table_extraction: 0,
        section_extraction: 0
      },
      qualityDistribution: {
        high: 0,    // confidence >= 0.9
        medium: 0,  // confidence 0.7-0.9
        low: 0      // confidence < 0.7
      }
    };
  }

  /**
   * Find all PDF files
   */
  async findPDFs() {
    try {
      const files = await fs.readdir(PDF_DIRECTORY);
      return files
        .filter(file => file.toLowerCase().endsWith('.pdf'))
        .map(file => path.join(PDF_DIRECTORY, file));
    } catch (error) {
      console.error(`Error reading PDF directory: ${error.message}`);
      return [];
    }
  }

  /**
   * Process all PDFs
   */
  async processAllPDFs() {
    console.log('🚀 STARTING REAL DATA EXTRACTION');
    console.log('=' .repeat(80));

    const pdfFiles = await this.findPDFs();
    this.stats.totalPDFs = pdfFiles.length;

    console.log(`\n📁 Found ${pdfFiles.length} PDF files\n`);

    const allRecords = [];
    let processedCount = 0;

    for (const pdfPath of pdfFiles) {
      processedCount++;
      console.log(`\n[${processedCount}/${pdfFiles.length}] Processing...`);

      try {
        const records = await this.parser.extractEmissionsData(pdfPath);

        if (records.length > 0) {
          allRecords.push(...records);
          this.stats.successfulExtractions++;

          // Track company
          const companyName = records[0].company_name;
          if (companyName && companyName !== 'Unknown') {
            this.stats.companiesExtracted.add(companyName);
          } else {
            this.stats.companiesFailed.push(path.basename(pdfPath));
          }

          // Track extraction methods
          records.forEach(r => {
            this.stats.byMethod[r.extraction_method] =
              (this.stats.byMethod[r.extraction_method] || 0) + 1;

            // Track quality
            if (r.confidence >= 0.9) this.stats.qualityDistribution.high++;
            else if (r.confidence >= 0.7) this.stats.qualityDistribution.medium++;
            else this.stats.qualityDistribution.low++;
          });

        } else {
          console.log(`   ⚠️  No data extracted`);
          this.stats.failedExtractions++;
        }

      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        this.stats.failedExtractions++;
      }
    }

    this.stats.totalRecords = allRecords.length;

    console.log('\n' + '='.repeat(80));
    console.log('✅ EXTRACTION COMPLETE\n');
    this.printSummary();

    return allRecords;
  }

  /**
   * Print extraction summary
   */
  printSummary() {
    console.log('📊 EXTRACTION SUMMARY:');
    console.log('─'.repeat(80));
    console.log(`Total PDFs Processed:        ${this.stats.totalPDFs}`);
    console.log(`Successful Extractions:      ${this.stats.successfulExtractions} ✅`);
    console.log(`Failed Extractions:          ${this.stats.failedExtractions} ❌`);
    console.log(`Total Records Extracted:     ${this.stats.totalRecords}`);
    console.log(`Unique Companies Found:      ${this.stats.companiesExtracted.size}`);
    console.log('');
    console.log('📈 EXTRACTION METHODS:');
    console.log(`   Table Extraction:         ${this.stats.byMethod.table_extraction} (${((this.stats.byMethod.table_extraction / this.stats.totalRecords) * 100).toFixed(1)}%)`);
    console.log(`   Section Extraction:       ${this.stats.byMethod.section_extraction} (${((this.stats.byMethod.section_extraction / this.stats.totalRecords) * 100).toFixed(1)}%)`);
    console.log('');
    console.log('⭐ QUALITY DISTRIBUTION:');
    console.log(`   High (≥0.9):              ${this.stats.qualityDistribution.high} (${((this.stats.qualityDistribution.high / this.stats.totalRecords) * 100).toFixed(1)}%)`);
    console.log(`   Medium (0.7-0.9):         ${this.stats.qualityDistribution.medium} (${((this.stats.qualityDistribution.medium / this.stats.totalRecords) * 100).toFixed(1)}%)`);
    console.log(`   Low (<0.7):               ${this.stats.qualityDistribution.low} (${((this.stats.qualityDistribution.low / this.stats.totalRecords) * 100).toFixed(1)}%)`);
    console.log('');

    if (this.stats.companiesFailed.length > 0) {
      console.log('⚠️  COMPANY NAME EXTRACTION FAILED FOR:');
      this.stats.companiesFailed.slice(0, 10).forEach(file => {
        console.log(`   - ${file}`);
      });
      if (this.stats.companiesFailed.length > 10) {
        console.log(`   ... and ${this.stats.companiesFailed.length - 10} more`);
      }
      console.log('');
    }

    console.log('🏢 COMPANIES EXTRACTED:');
    Array.from(this.stats.companiesExtracted).sort().slice(0, 20).forEach(company => {
      console.log(`   ✓ ${company}`);
    });
    if (this.stats.companiesExtracted.size > 20) {
      console.log(`   ... and ${this.stats.companiesExtracted.size - 20} more`);
    }
    console.log('─'.repeat(80));
  }

  /**
   * Save records to CSV
   */
  async saveToCSV(records) {
    console.log(`\n💾 Saving ${records.length} records to CSV...`);

    // CSV header
    const header = [
      'company_name',
      'year',
      'scope',
      'value',
      'unit',
      'source_file',
      'extraction_method',
      'confidence',
      'raw_text'
    ].join(',');

    // CSV rows
    const rows = records.map(r => {
      return [
        `"${(r.company_name || 'Unknown').replace(/"/g, '""')}"`,
        r.year || '',
        `"${(r.scope || '').replace(/"/g, '""')}"`,
        r.value || '',
        `"${(r.unit || '').replace(/"/g, '""')}"`,
        `"${(r.source_file || '').replace(/"/g, '""')}"`,
        r.extraction_method || '',
        r.confidence || '',
        `"${(r.raw_text || '').replace(/"/g, '""').replace(/\n/g, ' ').substring(0, 200)}"`
      ].join(',');
    });

    const csvContent = [header, ...rows].join('\n');

    await fs.writeFile(OUTPUT_FILE, csvContent, 'utf8');
    console.log(`   ✅ Saved to: ${OUTPUT_FILE}`);
  }

  /**
   * Save quality report
   */
  async saveReport() {
    const report = {
      extraction_date: new Date().toISOString(),
      statistics: {
        total_pdfs: this.stats.totalPDFs,
        successful_extractions: this.stats.successfulExtractions,
        failed_extractions: this.stats.failedExtractions,
        total_records: this.stats.totalRecords,
        unique_companies: this.stats.companiesExtracted.size
      },
      extraction_methods: this.stats.byMethod,
      quality_distribution: this.stats.qualityDistribution,
      companies_extracted: Array.from(this.stats.companiesExtracted).sort(),
      companies_failed: this.stats.companiesFailed,
      quality_metrics: {
        avg_records_per_pdf: (this.stats.totalRecords / this.stats.successfulExtractions).toFixed(2),
        table_extraction_rate: ((this.stats.byMethod.table_extraction / this.stats.totalRecords) * 100).toFixed(1) + '%',
        high_quality_rate: ((this.stats.qualityDistribution.high / this.stats.totalRecords) * 100).toFixed(1) + '%'
      }
    };

    await fs.writeFile(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');
    console.log(`   ✅ Quality report saved to: ${REPORT_FILE}`);
  }

  /**
   * Main execution
   */
  async run() {
    try {
      // Ensure output directory exists
      await fs.mkdir(path.join(__dirname, 'output'), { recursive: true });

      // Process all PDFs
      const records = await this.processAllPDFs();

      if (records.length === 0) {
        console.log('\n⚠️  No records extracted. Check PDF files and extraction logic.');
        return;
      }

      // Save results
      await this.saveToCSV(records);
      await this.saveReport();

      console.log('\n🎉 ALL DONE!');
      console.log(`\n📄 Output files:`);
      console.log(`   - Real data CSV: ${OUTPUT_FILE}`);
      console.log(`   - Quality report: ${REPORT_FILE}`);
      console.log('\n💡 Next steps:');
      console.log('   1. Review the quality report');
      console.log('   2. Check companies_failed list');
      console.log('   3. Compare with old em_data_2.csv');
      console.log('   4. Use emissions_data_REAL.csv for analysis\n');

    } catch (error) {
      console.error(`\n❌ Fatal error: ${error.message}`);
      console.error(error.stack);
      process.exit(1);
    }
  }
}

// Run extraction
const extractor = new RealDataExtractor();
extractor.run();
