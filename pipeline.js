#!/usr/bin/env node

/**
 * 🚀 ADVANCED EMISSION DATA PIPELINE
 *
 * A highly robust, multi-pass pipeline for extracting emissions data from diverse PDF sustainability reports.
 *
 * WORKFLOW:
 * 1. PDF Discovery: Scan for all PDF files.
 * 2. Multi-Pass Extraction:
 *    - Pass 1: High-confidence table extraction.
 *    - Pass 2: Keyword-driven value extraction.
 *    - Pass 3: Heuristic sentence-based extraction.
 * 3. Data Cleaning & Normalization: Standardize units, scopes, and company names.
 * 4. Deduplication: Consolidate records, keeping the most accurate data.
 * 5. Reporting: Generate final CSV and a detailed JSON report.
 *
 * USAGE:
 *   node pipeline.js
 */

import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import { fileURLToPath } from 'url';
import { PDFParser } from './src/pdfParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURATION ---
const CONFIG = {
  pdfDirectory: path.join(__dirname, 'downloads'),
  egyptPdfDirectory: path.join(__dirname, 'downloads', 'egypt'),
  pdfsRoot: path.join(__dirname, 'pdfs'),
  outputDirectory: path.join(__dirname, 'output'),
  files: {
    raw: 'emissions_data_RAW.csv',
    simple: 'emissions_data_SIMPLE.csv',
    summary: 'pipeline_report.json'
  }
};

// Allow overriding the PDF root via env var or CLI flag --pdf-root
function getPdfRootFromArgs() {
  const arg = process.argv.find(a => a.startsWith('--pdf-root='));
  if (arg) return arg.split('=')[1];
  if (process.env.PDF_OUTPUT_DIR) return process.env.PDF_OUTPUT_DIR;
  return null;
}

const PDF_ROOT_OVERRIDE = getPdfRootFromArgs();
if (PDF_ROOT_OVERRIDE) {
  console.log(`ℹ️  Using PDF root override: ${PDF_ROOT_OVERRIDE}`);
}

const USE_OCR = process.argv.includes('--use-ocr');
if (USE_OCR) console.log('ℹ️  OCR fallback enabled (--use-ocr)');

const USE_TABLES = process.argv.includes('--use-tables');
if (USE_TABLES) console.log('ℹ️  Table extraction enabled (--use-tables)');

// --- ADVANCED PDF PARSER ---
class AdvancedPDFParser {
  constructor(pdfParser) { // Dependency Injection
    this.pdf = pdfParser;
    this.extractionPatterns = [
      // High-Confidence Table Patterns (Scope, Value, Unit)
      {
        name: 'table-scope-value-unit',
        regex: /(Scope\s*[123])\s*[:\s]*([\d,]+\.?\d*)\s*(tonnes?|tCO2e|MT\s*CO2e|metric\s*tons?)/gi,
        fields: ['scope', 'value', 'unit']
      },
      // Keyword-Value Patterns
      {
        name: 'keyword-value',
        regex: /(?:Total\s+GHG\s+Emissions|Total\s+emissions|Total\s+carbon\s+emissions)\s*[:\s]*([\d,]+\.?\d*)\s*(tonnes?|tCO2e|MT\s*CO2e)/gi,
        fields: ['value', 'unit'],
        scope: 'Total'
      },
      {
        name: 'scope-keyword-value',
        regex: /(Scope\s*[123])\s+(?:emissions?|GHG)\s*[:\s]*([\d,]+\.?\d*)/gi,
        fields: ['scope', 'value'],
        unit: 'tCO2e'
      },
      // Heuristic Patterns
      {
        name: 'sentence-heuristic',
        regex: /our\s+(Scope\s*[123])\s+emissions\s+were\s+([\d,]+\.?\d*)\s*(tonnes?|tCO2e)/gi,
        fields: ['scope', 'value', 'unit']
      },
      // Additional Advanced Patterns
      {
        name: 'scope-colon-value-unit',
        regex: /(Scope\s*[123])\s*:\s*([\d,]+\.?\d*)\s*(tonnes?|tCO2e|MT\s*CO2e)/gi,
        fields: ['scope', 'value', 'unit']
      },
      {
        name: 'ghg-scope-value',
        regex: /GHG\s+(Scope\s*[123])\s*[:\s]*([\d,]+\.?\d*)\s*(tonnes?|tCO2e)/gi,
        fields: ['scope', 'value', 'unit']
      },
      {
        name: 'emissions-scope-value',
        regex: /emissions\s+(Scope\s*[123])\s*[:\s]*([\d,]+\.?\d*)\s*(tonnes?|tCO2e)/gi,
        fields: ['scope', 'value', 'unit']
      },
      {
        name: 'total-ghg-value-unit',
        regex: /Total\s+GHG\s*[:\s]*([\d,]+\.?\d*)\s*(tonnes?|tCO2e|MT\s*CO2e)/gi,
        fields: ['value', 'unit'],
        scope: 'Total'
      },
      {
        name: 'carbon-footprint-value',
        regex: /(?:Carbon\s+footprint|CO2\s+emissions)\s*[:\s]*([\d,]+\.?\d*)\s*(tonnes?|tCO2e)/gi,
        fields: ['value', 'unit'],
        scope: 'Total'
      },
      {
        name: 'scope-list-value',
        regex: /(Scope\s*[123])\s*,\s*(Scope\s*[123])\s*,\s*(Scope\s*[123])\s*[:\s]*([\d,]+\.?\d*)\s*(tonnes?|tCO2e)/gi,
        fields: ['scope1', 'scope2', 'scope3', 'value', 'unit'],
        scope: 'Total' // Assuming total for combined
      },
      {
        name: 'year-scope-value',
        regex: /(20\d{2})\s+(Scope\s*[123])\s+emissions\s*[:\s]*([\d,]+\.?\d*)\s*(tonnes?|tCO2e)/gi,
        fields: ['year', 'scope', 'value', 'unit']
      },
      {
        name: 'value-unit-scope',
        regex: /([\d,]+\.?\d*)\s*(tonnes?|tCO2e|MT\s*CO2e)\s+(Scope\s*[123])/gi,
        fields: ['value', 'unit', 'scope']
      },
      // New Patterns for More Coverage
      {
        name: 'ghg-emissions-value',
        regex: /GHG\s+emissions\s*[:\s]*([\d,]+\.?\d*)\s*(tonnes?|tCO2e|MT\s*CO2e)/gi,
        fields: ['value', 'unit'],
        scope: 'Total'
      },
      {
        name: 'scope-emissions-value-unit',
        regex: /(Scope\s*[123])\s+emissions\s*[:\s]*([\d,]+\.?\d*)\s*(tonnes?|tCO2e)/gi,
        fields: ['scope', 'value', 'unit']
      },
      {
        name: 'direct-emissions-value',
        regex: /Direct\s+emissions\s*[:\s]*([\d,]+\.?\d*)\s*(tonnes?|tCO2e)/gi,
        fields: ['value', 'unit'],
        scope: 'Scope 1'
      },
      {
        name: 'indirect-emissions-value',
        regex: /Indirect\s+emissions\s*[:\s]*([\d,]+\.?\d*)\s*(tonnes?|tCO2e)/gi,
        fields: ['value', 'unit'],
        scope: 'Scope 2'
      },
      {
        name: 'other-emissions-value',
        regex: /(?:Other|Scope\s*3)\s+emissions\s*[:\s]*([\d,]+\.?\d*)\s*(tonnes?|tCO2e)/gi,
        fields: ['value', 'unit'],
        scope: 'Scope 3'
      },
      {
        name: 'total-emissions-value-unit',
        regex: /Total\s+emissions\s*[:\s]*([\d,]+\.?\d*)\s*(tonnes?|tCO2e|MT\s*CO2e)/gi,
        fields: ['value', 'unit'],
        scope: 'Total'
      }
    ];
  }

  async extractData(pdfPath) {
    const records = [];
    try {
      const dataBuffer = await fs.readFile(pdfPath);
      const data = await this.pdf(dataBuffer); // Use injected parser
      const text = data.text;
      if (!text || typeof text !== 'string') return [];

      const year = this.extractYear(text) || new Date().getFullYear();

      for (const pattern of this.extractionPatterns) {
        const matches = text.matchAll(pattern.regex);
        for (const match of matches) {
          let scopeMatch = null;
          if (pattern.fields.includes('scope')) {
            scopeMatch = match[pattern.fields.indexOf('scope') + 1];
          } else if (pattern.fields.includes('scope1')) {
            scopeMatch = match[pattern.fields.indexOf('scope1') + 1];
          }
          const record = {
            year: pattern.fields.includes('year') ? parseInt(match[pattern.fields.indexOf('year') + 1], 10) : year,
            scope: pattern.scope || this.normalizeScope(scopeMatch),
            value: this.normalizeValue(match[pattern.fields.indexOf('value') + 1]),
            unit: pattern.unit || this.normalizeUnit(match[pattern.fields.indexOf('unit') + 1]),
            source_file: path.basename(pdfPath),
            extraction_method: pattern.name
          };
          if (record.value > 0) {
            records.push(record);
          }
        }
      }
    } catch (error) {
      console.error(`  ❌ Error parsing ${path.basename(pdfPath)}: ${error.message}`);
    }
    return records;
  }

  extractYear(text) {
    const match = text.match(/(20\d{2})\s+Sustainability\s+Report/i) || text.match(/Annual\s+Report\s+(20\d{2})/i);
    return match ? parseInt(match[1], 10) : null;
  }

  normalizeScope(scope) {
    if (!scope) return 'Unknown';
    const s = scope.toLowerCase();
    if (s.includes('scope 1') || s.includes('scope1')) return 'Scope 1';
    if (s.includes('scope 2') || s.includes('scope2')) return 'Scope 2';
    if (s.includes('scope 3') || s.includes('scope3')) return 'Scope 3';
    return 'Unknown';
  }

  normalizeValue(value) {
    if (!value) return 0;
    return parseFloat(value.replace(/,/g, ''));
  }

  normalizeUnit(unit) {
    if (!unit) return 'MT CO2e';
    const u = unit.toLowerCase().trim();
    if (u.includes('tonnes') || u.includes('tco2e') || u.includes('mt') || u.includes('metric')) {
      return 'MT CO2e';
    }
    if (u.includes('kg')) return 'kg CO2e';
    return 'MT CO2e'; // Default
  }
}

// --- MAIN PIPELINE ---
class AdvancedPipeline {
  constructor() {
    // Primary parser: richer multi-pattern parser implemented in src/pdfParser.js
    this.primaryParser = new PDFParser();
    // Fallback parser: pattern-driven parser using pdf-parse
    this.fallbackParser = new AdvancedPDFParser(pdfParse);
    this.stats = {
      pdfs: { total: 0, processed: 0, failed: 0 },
      records: { raw: 0, clean: 0, duplicates: 0 },
      methods: {}
    };
  }

  async run() {
    console.log('🚀 ADVANCED EMISSION DATA PIPELINE 🚀');
    console.log('============================================================');
    const startTime = Date.now();

    await fs.mkdir(CONFIG.outputDirectory, { recursive: true });

    const pdfFiles = await this.findPDFs();
    this.stats.pdfs.total = pdfFiles.length;
    console.log(`🔍 Found ${pdfFiles.length} PDF files to process.`);

    let allRecords = [];
    const verificationFile = path.join(CONFIG.outputDirectory, 'verification_missing_data.csv');
    // ensure verification file header
    await fs.writeFile(verificationFile, 'filename,excerpt\n', { flag: 'a' });

    for (const pdfPath of pdfFiles) {
      console.log(`\n📄 Processing: ${path.basename(pdfPath)}`);

      // 1) Primary extraction (more context-aware)
      let records = await this.primaryParser.extractEmissionsData(pdfPath);
      if (records && records.length > 0) {
        // Map primary parser fields to pipeline standardized fields
        records = records.map(r => ({
          year: r.year || new Date().getFullYear(),
          scope: r.scope || 'Unknown',
          value: Number(r.value || 0),
          unit: r.unit || 'MT CO2e',
          source_file: path.basename(pdfPath),
          extraction_method: 'primary:pdfParser',
          raw: r.rawText || ''
        }));
      } else {
        // 2) Fallback extraction (pattern engine)
        records = await this.fallbackParser.extractData(pdfPath);
      }

      if (records && records.length > 0) {
        records.forEach(r => {
          r.company_name = this.guessCompanyFromFilename(r.source_file);
          this.stats.methods[r.extraction_method] = (this.stats.methods[r.extraction_method] || 0) + 1;
        });
        allRecords.push(...records);
        console.log(`  ✅ Extracted ${records.length} potential records.`);
        this.stats.pdfs.processed++;
      } else {
        console.log('  ⚠️  No data extracted from primary or fallback extractors.');
        // Attempt OCR fallback if enabled
        if (USE_OCR) {
          try {
            const extractWithOCR = (await import('./extract_with_ocr.js')).default;
            console.log('   🔄 Running OCR fallback...');
            const ocrRecords = await extractWithOCR(pdfPath);
            if (ocrRecords && ocrRecords.length > 0) {
              ocrRecords.forEach(r => {
                r.company_name = this.guessCompanyFromFilename(r.source_file || path.basename(pdfPath));
                r.extraction_method = 'ocr:tesseract';
              });
              allRecords.push(...ocrRecords);
              console.log(`   ✅ OCR extracted ${ocrRecords.length} records.`);
              this.stats.pdfs.processed++;
              continue; // proceed to next PDF
            }
          } catch (e) {
            console.warn('   ⚠️ OCR fallback failed:', e.message);
          }
        }
        // Try table extractor if enabled
        if (USE_TABLES) {
          try {
            const { spawnSync } = await import('child_process');
            console.log('   🔄 Running table extraction (pdfplumber)...');
            const py = spawnSync('python', [path.join(__dirname, 'extract_tables.py'), pdfPath], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
            if (py.status === 0 && py.stdout) {
              const parsed = JSON.parse(py.stdout);
              if (Array.isArray(parsed) && parsed.length > 0) {
                const tableRecords = parsed.map(r => ({
                  year: r.year || new Date().getFullYear(),
                  scope: r.scope || 'Unknown',
                  value: Number(r.value || 0),
                  unit: r.unit || 'MT CO2e',
                  source_file: path.basename(pdfPath),
                  extraction_method: 'table:pdfplumber'
                }));
                allRecords.push(...tableRecords);
                console.log(`   ✅ Table extraction found ${tableRecords.length} records.`);
                this.stats.pdfs.processed++;
                continue;
              }
            } else {
              console.warn('   ⚠️ Table extractor failed or missing (python/pdfplumber).');
            }
          } catch (e) {
            console.warn('   ⚠️ Table extraction error:', e.message);
          }
        }
        console.log('  ⚠️  No data extracted.');
        this.stats.pdfs.failed++;
        // append a short excerpt to verification CSV for manual review
        try {
          const txt = await this.primaryParser.extractText(pdfPath);
          const excerpt = txt ? txt.replace(/\r?\n/g, ' ').slice(0, 240).replace(/,/g, ' ') : '';
          await fs.appendFile(verificationFile, `${path.basename(pdfPath)},"${excerpt}"\n`);
        } catch (e) {
          await fs.appendFile(verificationFile, `${path.basename(pdfPath)},"(no text)"\n`);
        }
      }
    }

    this.stats.records.raw = allRecords.length;
    console.log(`\n\nExtraction complete. Found ${allRecords.length} raw records.`);

    const cleanRecords = this.cleanAndDeduplicate(allRecords);
    this.stats.records.clean = cleanRecords.length;

    await this.saveToCSV(cleanRecords, CONFIG.files.simple);
    await this.generateReport();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 Pipeline finished in ${duration}s.`);
    this.printSummary();
  }

  async findPDFs() {
    const allPdfs = new Set();

    const tryAddFromDir = async (dir) => {
      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          const full = path.join(dir, file);
          const stat = await fs.stat(full);
          if (stat.isDirectory()) {
            await tryAddFromDir(full);
          } else if (file.toLowerCase().endsWith('.pdf')) {
            allPdfs.add(full);
          }
        }
      } catch (error) {
        // ignore missing dirs
      }
    };

    await tryAddFromDir(CONFIG.pdfDirectory).catch(() => {});
    await tryAddFromDir(CONFIG.egyptPdfDirectory).catch(() => {});
    await tryAddFromDir(CONFIG.pdfsRoot).catch(() => {});

    return Array.from(allPdfs).sort();
  }

  guessCompanyFromFilename(filename) {
    let cleaned = filename.replace(/\.pdf$/i, '').replace(/[_-\s]+/g, ' ').trim();
    cleaned = cleaned.replace(/sustainability|report|annual|integrated|view|\d{4}/gi, '').trim();
    cleaned = cleaned.replace(/(^\d+\s*)|(\s+\d+$)/g, '').trim();
    return cleaned || 'Unknown Company';
  }

  cleanAndDeduplicate(records) {
    const seen = new Map();
    for (const record of records) {
      const key = `${record.company_name}|${record.year}|${record.scope}`;
      if (!seen.has(key) || record.value > seen.get(key).value) {
        seen.set(key, record);
      } else {
        this.stats.records.duplicates++;
      }
    }
    // Map to CSV-friendly standardized format
    return Array.from(seen.values()).map(r => ({
      company_name: r.company_name,
      year: r.year,
      scope: r.scope,
      value: Number(r.value),
      unit: r.unit || 'MT CO2e',
      source_file: r.source_file,
      extraction_method: r.extraction_method
    }));
  }

  async saveToCSV(records, filename) {
    const filepath = path.join(CONFIG.outputDirectory, filename);
    const header = 'company_name,year,scope,value,unit,source_file,extraction_method';
    const rows = records.map(r =>
      [r.company_name, r.year, r.scope, r.value, r.unit, r.source_file, r.extraction_method].join(',')
    );
    await fs.writeFile(filepath, [header, ...rows].join('\n'));
    console.log(`\n💾 Saved ${records.length} records to ${filepath}`);
  }

  async generateReport() {
    const reportFile = path.join(CONFIG.outputDirectory, CONFIG.files.summary);
    await fs.writeFile(reportFile, JSON.stringify(this.stats, null, 2));
    console.log(`📊 Report saved to ${reportFile}`);
  }

  printSummary() {
    console.log('\n--- PIPELINE SUMMARY ---');
    console.log(`PDFs Processed: ${this.stats.pdfs.processed}/${this.stats.pdfs.total}`);
    console.log(`Raw Records Found: ${this.stats.records.raw}`);
    console.log(`Clean Records: ${this.stats.records.clean}`);
    console.log('Extraction Methods Breakdown:');
    for (const [method, count] of Object.entries(this.stats.methods)) {
      console.log(`  - ${method}: ${count} records`);
    }
    console.log('------------------------');
  }
}

// --- PIPELINE EXECUTION ---
const pipeline = new AdvancedPipeline(/* PDF Parser Dependency */);
pipeline.run().catch(error => {
  console.error(`🚀 Pipeline failed: ${error.message}`);
  process.exit(1);
});
