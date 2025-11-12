/**
 * 📊 STANDALONE CSV GENERATION STEP
 * 
 * Processes PDFs from downloads/ folder and generates CSV
 * Does NOT do web scraping
 * 
 * USAGE:
 *   node run_csv_generation.js
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFParser } from './src/pdfParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  pdfDirectory: path.join(__dirname, 'downloads'),
  outputDirectory: path.join(__dirname, 'output'),
  files: {
    raw: 'emissions_data_RAW.csv',
    clean: 'emissions_data_CLEAN.csv',
    simple: 'emissions_data_SIMPLE.csv',
    summary: 'pipeline_report.json'
  }
};

// Company name mapping (same as pipeline.js)
const COMPANY_MAP = {
  '2020_FB_Sustainability-Report.pdf': 'Meta Platforms Inc (Facebook)',
  'FB_Sustainability': 'Meta Platforms Inc (Facebook)',
  '2022_Citizenship_Report.pdf': 'Starbucks Corporation',
  '2023-sustainability-report.pdf': 'Chipotle Mexican Grill',
  '2024-CCEP-Annual-Report_2025.03.21_Interactive.pdf': 'Coca-Cola Europacific Partners',
  'heineken_n_v_annual_report_2024_final_20feb2025.pdf': 'Heineken NV',
  'FrieslandCampina': 'FrieslandCampina',
  '2024-sustainability-report.pdf': 'Netflix Inc',
  '2024-tesla-impact-report.pdf': 'Tesla Inc',
  'Apple_Environmental_Progress_Report_2025.pdf': 'Apple Inc',
  'google-2020-environmental-report.pdf': 'Google LLC (Alphabet Inc)',
  '2024-esg-summary-esg-performance-metrics.pdf': 'JPMorgan Chase & Co',
  'ABN_AMRO___Integrated_Annual_Report_2024.pdf': 'ABN AMRO Bank NV',
  'CB-Annual_Report_2024_-_EN.pdf': 'Crédit Agricole Consumer Finance',
  'ing_Annual_Report_2024_1761270292451.pdf': 'ING Bank NV',
  'nn-group_Annual_Report_2024_1761270844314.pdf': 'NN Group NV',
  'vanlanschotkempen_Annual_Report_2023_1761275151347.pdf': 'Van Lanschot Kempen',
  'Rabobank': 'Rabobank',
  '30060-Burg-MVO-CSR-verslag-EN-2024-v6.pdf': 'Royal Burg Groep',
  'ah-duurzaamheidsverslag-2024-eng.pdf': 'Ahold Delhaize (Albert Heijn)',
  'ah-duurzaamheidsverslag-2024.pdf': 'Ahold Delhaize (Albert Heijn)',
  'KPN-integrated-annual-report-2024_2025-02-21-143127_spyv.pdf': 'KPN (Koninklijke KPN NV)',
  'VodafoneZiggo_Integrated_Annual_Report_2024.pdf': 'VodafoneZiggo',
  'PhilipsFullAnnualReport2024-English.pdf': 'Philips',
  'ReNew-Annual-Integrated-Report-FY-2023-24.pdf': 'ReNew Energy Global',
  'nike-fy23-impact-report': 'Nike Inc',
  'walmart': 'Walmart Inc',
  'IKEA-Sustainability-Report': 'IKEA',
  'Shell_Sustainability_Report_2024': 'Shell PLC',
  'Unilever-Annual-Report-2024': 'Unilever PLC',
  // Add more mappings as needed
};

class CSVGenerator {
  constructor() {
    this.parser = new PDFParser();
    this.stats = {
      pdfs: { total: 0, successful: 0, failed: 0 },
      extraction: { total: 0, duplicates: 0, invalid: 0 },
      cleaning: { total: 0, fixed: 0, removed: 0 },
      final: { records: 0, companies: 0, quality: {} }
    };
  }

  async run() {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║         CSV GENERATION - STEP 2 ONLY                          ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    const startTime = Date.now();

    try {
      // Ensure output directory exists
      await fs.mkdir(CONFIG.outputDirectory, { recursive: true });

      // Step 1: Extract from PDFs
      await this.extractFromPDFs();

      // Step 2: Clean data
      await this.cleanData();

      // Step 3: Simplify
      await this.simplifyData();

      // Step 4: Generate reports
      await this.generateReports();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✅ CSV generation completed in ${duration}s\n`);

      this.printSummary();

    } catch (error) {
      console.error('\n❌ CSV generation failed:', error.message);
      throw error;
    }
  }

  async extractFromPDFs() {
    console.log('📄 STEP 1: Extracting from PDFs');
    console.log('─'.repeat(70));

    const pdfFiles = await this.findPDFs();
    this.stats.pdfs.total = pdfFiles.length;
    
    if (pdfFiles.length === 0) {
      console.log('❌ No PDF files found in downloads/ folder');
      console.log('\nPlease run web scraping first:');
      console.log('   node run_web_scraping.js\n');
      process.exit(1);
    }

    console.log(`Found ${pdfFiles.length} PDF files\n`);

    const allRecords = [];

    for (const pdfPath of pdfFiles) {
      const filename = path.basename(pdfPath);
      console.log(`Processing: ${filename}`);

      try {
        const records = await this.parser.extractEmissionsData(pdfPath);

        if (records && records.length > 0) {
          const companyName = await this.getCompanyNameSmart(filename, pdfPath);
          records.forEach(r => {
            r.company_name = companyName;
            r.source_file = filename;
          });

          allRecords.push(...records);
          this.stats.pdfs.successful++;
          console.log(`  ✅ Extracted ${records.length} records\n`);
        } else {
          this.stats.pdfs.failed++;
          console.log(`  ⚠️  No data found\n`);
        }
      } catch (error) {
        this.stats.pdfs.failed++;
        console.log(`  ❌ Error: ${error.message}\n`);
      }
    }

    this.stats.extraction.total = allRecords.length;
    console.log(`✅ Extraction complete: ${allRecords.length} records\n`);

    await this.saveCSV(allRecords, CONFIG.files.raw, [
      'company_name', 'year', 'scope', 'category', 'value', 'unit', 'source_file'
    ]);
  }

  async cleanData() {
    console.log('🧹 STEP 2: Cleaning and deduplicating');
    console.log('─'.repeat(70));

    const rawFile = path.join(CONFIG.outputDirectory, CONFIG.files.raw);
    const content = await fs.readFile(rawFile, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const records = this.parseCSV(lines);

    console.log(`Loaded ${records.length} raw records`);

    const cleanRecords = [];
    const seen = new Set();

    for (const record of records) {
      if (!this.isValidRecord(record)) {
        this.stats.cleaning.removed++;
        continue;
      }

      const key = this.createDedupKey(record);
      if (seen.has(key)) {
        this.stats.extraction.duplicates++;
        continue;
      }
      seen.add(key);

      record.confidence_score = this.calculateConfidence(record);
      cleanRecords.push(record);
    }

    this.stats.cleaning.total = cleanRecords.length;
    console.log(`✅ Cleaned: ${cleanRecords.length} records`);
    console.log(`   Removed: ${this.stats.cleaning.removed} invalid`);
    console.log(`   Duplicates: ${this.stats.extraction.duplicates}\n`);

    await this.saveCSV(cleanRecords, CONFIG.files.clean, [
      'company_name', 'year', 'scope', 'category', 'value', 'unit',
      'source_file', 'confidence_score'
    ]);
  }

  async simplifyData() {
    console.log('📊 STEP 3: Simplifying to essential columns');
    console.log('─'.repeat(70));

    const cleanFile = path.join(CONFIG.outputDirectory, CONFIG.files.clean);
    const content = await fs.readFile(cleanFile, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const records = this.parseCSV(lines);

    console.log(`Simplifying ${records.length} records`);

    const simplified = records.map(r => ({
      company_name: r.company_name,
      year: r.year,
      scope: r.scope,
      value: r.value,
      unit: r.unit,
      source_file: r.source_file,
      confidence_score: r.confidence_score
    }));

    this.stats.final.records = simplified.length;
    this.stats.final.companies = new Set(simplified.map(r => r.company_name)).size;

    console.log(`✅ Simplified to 7 columns: ${simplified.length} records\n`);

    await this.saveCSV(simplified, CONFIG.files.simple, [
      'company_name', 'year', 'scope', 'value', 'unit',
      'source_file', 'confidence_score'
    ]);
  }

  async generateReports() {
    console.log('📊 STEP 4: Generating reports');
    console.log('─'.repeat(70));

    const report = {
      generated: new Date().toISOString(),
      pipeline_version: '1.0.0',
      statistics: this.stats,
      files: {
        input: `${this.stats.pdfs.total} PDF files`,
        output: {
          raw: CONFIG.files.raw,
          clean: CONFIG.files.clean,
          simple: CONFIG.files.simple
        }
      },
      quality_metrics: {
        extraction_success_rate: `${((this.stats.pdfs.successful / this.stats.pdfs.total) * 100).toFixed(1)}%`,
        deduplication_rate: `${((this.stats.extraction.duplicates / this.stats.extraction.total) * 100).toFixed(1)}%`,
        final_record_count: this.stats.final.records,
        unique_companies: this.stats.final.companies
      }
    };

    const reportFile = path.join(CONFIG.outputDirectory, CONFIG.files.summary);
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2));

    console.log(`✅ Report saved: ${CONFIG.files.summary}\n`);
  }

  printSummary() {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                    CSV GENERATION SUMMARY                    ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    console.log('📊 RESULTS:');
    console.log(`   PDFs Processed:     ${this.stats.pdfs.successful}/${this.stats.pdfs.total}`);
    console.log(`   Records Extracted:  ${this.stats.extraction.total}`);
    console.log(`   Duplicates Removed: ${this.stats.extraction.duplicates}`);
    console.log(`   Final Records:      ${this.stats.final.records}`);
    console.log(`   Unique Companies:   ${this.stats.final.companies}\n`);

    console.log('📁 OUTPUT FILES:');
    const simplePath = path.join(CONFIG.outputDirectory, CONFIG.files.simple);
    console.log(`   ✅ ${CONFIG.files.simple} (USE THIS - 7 columns)`);
    console.log(`      Location: ${simplePath}`);
    console.log(`   📋 ${CONFIG.files.clean} (full data with metadata)`);
    console.log(`   📊 ${CONFIG.files.summary} (quality report)\n`);

    console.log('🚀 NEXT STEPS:');
    console.log(`   Import-Csv "${simplePath}"\n`);
  }

  // Helper methods (same as pipeline.js)
  async findPDFs() {
    try {
      const files = await fs.readdir(CONFIG.pdfDirectory);
      return files
        .filter(file => file.toLowerCase().endsWith('.pdf'))
        .map(file => path.join(CONFIG.pdfDirectory, file));
    } catch (error) {
      console.error(`Error reading PDF directory: ${error.message}`);
      return [];
    }
  }

  async getCompanyNameSmart(filename, pdfPath) {
    for (const [pattern, company] of Object.entries(COMPANY_MAP)) {
      if (filename.toLowerCase().includes(pattern.toLowerCase())) {
        return company;
      }
    }
    const fromFile = this.guessCompanyFromFilename(filename);
    if (fromFile) return fromFile;
    try {
      const text = await this.parser.extractText(pdfPath);
      if (text && text.length > 0) {
        const fromText = this.guessCompanyFromText(text);
        if (fromText) return fromText;
      }
    } catch {}
    return 'Unknown Company';
  }

  guessCompanyFromFilename(filename) {
    const base = filename.replace(/\.pdf$/i, '');
    const cleaned = base
      .replace(/[_\-]+/g, ' ')
      .replace(/\b(annual|integrated|impact|sustainability|report|jaarverslag|verslag|english|en|nl|de|fr|final|interactive|compressed|urd)\b/gi, ' ')
      .replace(/\b(\d{4}|fy\d{2}|v\d+)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return null;
    const known = [
      ['abn amro', 'ABN AMRO Bank NV'], ['apple', 'Apple Inc'],
      ['google', 'Google LLC (Alphabet Inc)'], ['tesla', 'Tesla Inc']
    ];
    const lower = cleaned.toLowerCase();
    for (const [token, company] of known) {
      if (lower.includes(token)) return company;
    }
    const words = cleaned.split(' ').filter(Boolean);
    if (words.length >= 2) {
      return words.slice(0, 2).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
    }
    return null;
  }

  guessCompanyFromText(text) {
    const first = text.substring(0, 8000);
    const legal = first.match(/\b([A-Z][A-Za-z&\-\s]{2,}?)\s+(Inc\.?|Incorporated|LLC\.?|Corporation|Corp\.?|PLC\.?|N\.?V\.?|Group|Holdings?|Bank|NV|N\.V\.)\b/);
    if (legal) return legal[0].trim().replace(/\s{2,}/g, ' ');
    return null;
  }

  isValidRecord(record) {
    if (!record.company_name || record.company_name === 'Unknown Company') return false;
    const yearNum = parseInt(record.year, 10);
    if (isNaN(yearNum) || yearNum < 2010 || yearNum > 2035) return false;
    const validScopes = new Set(['Scope 1', 'Scope 2', 'Scope 3', 'Total']);
    if (!record.scope || !validScopes.has(record.scope)) return false;
    const valueNum = parseFloat(String(record.value).toString().replace(/,/g, ''));
    if (isNaN(valueNum) || valueNum <= 0 || valueNum > 100000000) return false;
    record.value = valueNum;
    const unit = (record.unit || '').toLowerCase();
    if (unit.includes('mt co2e') || unit.includes('mtco2e')) record.unit = 'MT CO2e';
    else if (unit.includes('tco2e') || unit.includes('tonnes co2e')) record.unit = 'tonnes CO2e';
    else if (unit.includes('metric tons')) record.unit = 'Metric Tons';
    else record.unit = 'Unknown';
    const validUnits = new Set(['MT CO2e', 'tonnes CO2e', 'Metric Tons']);
    if (!validUnits.has(record.unit)) return false;
    return true;
  }

  createDedupKey(record) {
    const company = (record.company_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const year = record.year || '';
    const scope = (record.scope || '').toLowerCase().replace(/\s/g, '');
    const value = Math.round((parseFloat(record.value || 0)) * 100) / 100;
    return `${company}|${year}|${scope}|${value}`;
  }

  calculateConfidence(record) {
    let score = 0.5;
    if (record.year && !isNaN(parseInt(record.year))) score += 0.1;
    if (record.scope && ['Scope 1','Scope 2','Scope 3','Total'].includes(record.scope)) score += 0.1;
    if (record.unit && ['MT CO2e','tonnes CO2e','Metric Tons'].includes(record.unit)) score += 0.1;
    if (record.category) score += 0.05;
    if (record.company_name && record.company_name !== 'Unknown Company') score += 0.15;
    return Math.min(score, 1.0);
  }

  parseCSV(lines) {
    if (lines.length === 0) return [];
    const header = this.parseCSVLine(lines[0]);
    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = this.parseCSVLine(lines[i]);
      const record = {};
      header.forEach((h, idx) => {
        record[h] = cols[idx] || '';
      });
      records.push(record);
    }
    return records;
  }

  parseCSVLine(line) {
    const cols = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cols.push(current.trim());
    return cols;
  }

  async saveCSV(records, filename, columns) {
    if (records.length === 0) return;
    const filepath = path.join(CONFIG.outputDirectory, filename);
    const header = columns.join(',');
    const rows = records.map(r => {
      return columns.map(col => {
        const value = String(r[col] || '');
        if (value.includes(',') || value.includes('"')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    });
    const content = [header, ...rows].join('\n');
    await fs.writeFile(filepath, content, 'utf8');
    console.log(`   Saved: ${filename}`);
  }
}

// Run CSV generation
const generator = new CSVGenerator();
generator.run().catch(error => {
  console.error('CSV generation failed:', error);
  process.exit(1);
});



