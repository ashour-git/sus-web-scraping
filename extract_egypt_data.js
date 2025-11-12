#!/usr/bin/env node

/**
 * 🇪🇬 EGYPT SUSTAINABILITY REPORTS EXTRACTION
 *
 * Specialized extraction for Egyptian company sustainability reports
 * Processes 35 Egyptian PDFs and creates professional emissions dataset
 *
 * Features:
 * - Egyptian market focus (banks, telecom, manufacturing)
 * - Arabic/English bilingual report handling
 * - Enhanced pattern recognition for Egyptian companies
 * - Professional data quality and validation
 *
 * USAGE:
 *   node extract_egypt_data.js
 */

console.log('🚀 Script starting...');

import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFParser } from './src/pdfParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  egyptPdfDirectory: path.join(__dirname, 'downloads', 'Egypt Sustainability Reports'),
  outputDirectory: path.join(__dirname, 'output'),
  existingDataFile: path.join(__dirname, 'output', 'emissions_data_with_countries.csv'),
  newDataFile: path.join(__dirname, 'output', 'emissions_data_v2_egypt_included.csv'),
  logFile: path.join(__dirname, 'output', 'egypt_extraction_log.json')
};

// Egyptian company mapping with enhanced recognition
const EGYPTIAN_COMPANY_MAP = {
  // Banking Sector
  'aaib': 'Arab African International Bank',
  'aaib-2023-sustainability-report': 'Arab African International Bank',
  'ebank': 'Egyptian Banks Company (EBank)',
  'EBank-Sustainability-Annual-Report-2024': 'Egyptian Banks Company (EBank)',
  'EBank-Sustainability-Report-2023': 'Egyptian Banks Company (EBank)',
  'fabmisr': 'Banque Misr',
  'FABMISR-Sustainability-Report-2023': 'Banque Misr',
  'nbd': 'National Bank of Egypt',
  'NBD egypt_sustainability_report_2023': 'National Bank of Egypt',
  'saib': 'Société Arabe Internationale de Banque',
  'saib-bank-2023-sustainability-report': 'Société Arabe Internationale de Banque',

  // Telecom Sector
  'etisalat': 'Etisalat Egypt',
  'EtisalatEgyptbye': 'Etisalat Egypt',
  'vodafone': 'Vodafone Egypt',
  'vodafone-egypt': 'Vodafone Egypt',

  // Manufacturing & Consumer Goods
  'edita': 'Edita Food Industries',
  'Edita-SR20-21': 'Edita Food Industries',
  'egyptalum': 'Egyptalum',
  'Sustainability__Report__for_Egyptalum': 'Egyptalum',

  // Other Financial Services
  'hu': 'Hawkamah - The UAE Institute for Corporate Governance',
  'HU-Sustainability-Report-2024': 'Hawkamah',

  // Generic patterns for Egyptian companies
  'sustainability-report': 'Egyptian Company',
  'sustainability_report': 'Egyptian Company'
};

// Enhanced emission patterns for Egyptian reports
const EGYPTIAN_EMISSION_PATTERNS = [
  // Arabic-influenced patterns
  /(\d+(?:\.\d+)?)\s*(?:طن|tonnes?|tons?|MT|million tonnes?)\s*(?:CO2e?|CO₂|انبعاثات|emissions?)/gi,
  /(انبعاثات|emissions?)\s*(?:الكربون|carbon)\s*[:\-]?\s*(\d+(?:\.\d+)?)/gi,

  // Standard international patterns
  /(?:Scope|نطاق)\s*([123])\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:MT|tonnes?|tons?|طن)/gi,
  /(?:total|إجمالي)\s*(?:emissions|انبعاثات)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:MT|tonnes?|tons?)/gi,

  // Financial sector specific
  /(?:GHG|انبعاثات)\s*(?:emissions?|الغازات)\s*(\d+(?:\.\d+)?)\s*(?:tonnes?|tons?)/gi,
  /(?:carbon|كربون)\s*(?:footprint|بصمة)\s*[:\-]?\s*(\d+(?:\.\d+)?)/gi
];

class EgyptEmissionsExtractor {
  constructor() {
    this.pdfParser = new PDFParser();
    this.extractedData = [];
    this.processingStats = {
      totalFiles: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      totalRecords: 0
    };
  }

  /**
   * Main extraction workflow
   */
  async extractEgyptData() {
    console.log('🇪🇬 Starting Egyptian Sustainability Reports Extraction');
    console.log('=' .repeat(60));
    console.log('📁 Egypt PDF Directory:', CONFIG.egyptPdfDirectory);

    try {
      // Get all Egyptian PDF files
      const pdfFiles = await this.getEgyptPdfFiles();
      this.processingStats.totalFiles = pdfFiles.length;

      console.log(`📁 Found ${pdfFiles.length} Egyptian PDF files to process`);

      // Process each PDF
      for (const pdfFile of pdfFiles) {
        await this.processEgyptPdf(pdfFile);
      }

      // Generate extraction report
      await this.generateExtractionReport();

      // Combine with existing data
      await this.combineWithExistingData();

      console.log('\n✅ Egyptian data extraction completed successfully!');
      console.log(`📊 Extracted ${this.processingStats.totalRecords} records from ${this.processingStats.successfulExtractions} PDFs`);

    } catch (error) {
      console.error('❌ Error in Egyptian data extraction:', error);
      throw error;
    }
  }

  /**
   * Get all Egyptian PDF files
   */
  async getEgyptPdfFiles() {
    try {
      const files = await fs.readdir(CONFIG.egyptPdfDirectory);
      return files
        .filter(file => file.toLowerCase().endsWith('.pdf'))
        .map(file => path.join(CONFIG.egyptPdfDirectory, file));
    } catch (error) {
      console.error('Error reading Egypt PDF directory:', error);
      return [];
    }
  }

  /**
   * Process individual Egyptian PDF
   */
  async processEgyptPdf(pdfPath) {
    const fileName = path.basename(pdfPath);
    console.log(`\n📄 Processing: ${fileName}`);

    try {
      // Extract text using standard parser
      const text = await this.pdfParser.extractText(pdfPath);
      if (!text) {
        console.log(`⚠️  No text extracted from ${fileName}`);
        this.processingStats.failedExtractions++;
        return;
      }

      // Identify company
      const company = this.identifyEgyptianCompany(fileName, text);

      // Extract emissions using enhanced patterns
      const records = await this.extractEmissionsFromEgyptPdf(text, company, pdfPath);

      if (records.length > 0) {
        this.extractedData.push(...records);
        this.processingStats.successfulExtractions++;
        this.processingStats.totalRecords += records.length;
        console.log(`✅ Extracted ${records.length} records from ${company}`);
      } else {
        console.log(`⚠️  No emissions data found in ${fileName}`);
        this.processingStats.failedExtractions++;
      }

    } catch (error) {
      console.error(`❌ Error processing ${fileName}:`, error.message);
      this.processingStats.failedExtractions++;
    }
  }

  /**
   * Identify Egyptian company from filename and content
   */
  identifyEgyptianCompany(fileName, text) {
    const lowerFileName = fileName.toLowerCase();

    // Check direct mappings
    for (const [key, company] of Object.entries(EGYPTIAN_COMPANY_MAP)) {
      if (lowerFileName.includes(key.toLowerCase())) {
        return company;
      }
    }

    // Try to extract from text (look for company name patterns)
    const companyPatterns = [
      /(?:Arab African International Bank|AAIB)/i,
      /(?:Egyptian Banks Company|EBank)/i,
      /(?:Banque Misr|FABMISR)/i,
      /(?:National Bank of Egypt|NBD)/i,
      /(?:Etisalat Egypt)/i,
      /(?:Vodafone Egypt)/i,
      /(?:Edita Food Industries)/i,
      /(?:Egyptalum)/i
    ];

    for (const pattern of companyPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    // Fallback to filename-based identification
    return `Egyptian Company (${fileName.replace('.pdf', '')})`;
  }

  /**
   * Extract emissions data using Egyptian-specific patterns
   */
  async extractEmissionsFromEgyptPdf(text, company, pdfPath) {
    const records = [];
    const lines = text.split('\n');

    // Apply Egyptian-specific patterns
    for (const pattern of EGYPTIAN_EMISSION_PATTERNS) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const record = this.parseEmissionMatch(match, company, pdfPath, lines);
        if (record) {
          records.push(record);
        }
      }
    }

    // Also try standard PDFParser for additional extraction
    const standardRecords = await this.pdfParser.extractEmissionsData(pdfPath);
    for (const record of standardRecords) {
      records.push({
        ...record,
        company: company,
        country: 'Egypt',
        source: 'Egypt Sustainability Reports'
      });
    }

    // Remove duplicates and validate
    return this.deduplicateAndValidate(records);
  }

  /**
   * Parse emission match into structured record
   */
  parseEmissionMatch(match, company, pdfPath, lines) {
    try {
      // Extract value and unit
      const value = this.extractNumericValue(match);
      if (!value || value < 1) return null; // Filter out invalid values

      // Determine scope if available
      const scope = this.determineScope(match, lines);

      // Extract year
      const year = this.extractYearFromContext(lines, match.index) || '2023'; // Default to recent year

      return {
        company: company,
        year: year,
        scope: scope,
        emissions: value,
        unit: 'MT CO2e',
        country: 'Egypt',
        source: 'Egypt Sustainability Reports',
        pdf_file: path.basename(pdfPath),
        extraction_method: 'Egypt-Enhanced Patterns',
        confidence: this.calculateConfidence(match, value)
      };

    } catch (error) {
      console.warn('Error parsing emission match:', error.message);
      return null;
    }
  }

  /**
   * Extract numeric value from regex match
   */
  extractNumericValue(match) {
    for (const group of match.slice(1)) {
      if (group && !isNaN(parseFloat(group.replace(/,/g, '')))) {
        return parseFloat(group.replace(/,/g, ''));
      }
    }
    return null;
  }

  /**
   * Determine emission scope from context
   */
  determineScope(match, lines) {
    const matchText = match[0].toLowerCase();
    const contextStart = Math.max(0, match.index - 500);
    const contextEnd = Math.min(lines.length, match.index + 500);
    const context = lines.slice(contextStart, contextEnd).join(' ').toLowerCase();

    if (matchText.includes('scope 1') || context.includes('scope 1')) return 'Scope 1';
    if (matchText.includes('scope 2') || context.includes('scope 2')) return 'Scope 2';
    if (matchText.includes('scope 3') || context.includes('scope 3')) return 'Scope 3';

    // Default to total if no specific scope found
    return 'Total';
  }

  /**
   * Extract year from context
   */
  extractYearFromContext(lines, matchIndex) {
    const contextLines = lines.slice(
      Math.max(0, matchIndex - 10),
      Math.min(lines.length, matchIndex + 10)
    );

    const yearPattern = /(?:20|19)\d{2}/g;
    for (const line of contextLines) {
      const yearMatch = line.match(yearPattern);
      if (yearMatch) {
        // Return the most recent year found
        return Math.max(...yearMatch.map(y => parseInt(y))).toString();
      }
    }

    return null;
  }

  /**
   * Calculate extraction confidence
   */
  calculateConfidence(match, value) {
    let confidence = 0.5; // Base confidence

    // Higher confidence for explicit scope mentions
    if (match[0].toLowerCase().includes('scope')) confidence += 0.2;

    // Higher confidence for reasonable value ranges
    if (value >= 10 && value <= 100000) confidence += 0.2;

    // Higher confidence for standard units
    if (match[0].toLowerCase().includes('mt') || match[0].toLowerCase().includes('ton')) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * Remove duplicates and validate records
   */
  deduplicateAndValidate(records) {
    const seen = new Set();
    const validRecords = [];

    for (const record of records) {
      const key = `${record.company}-${record.year}-${record.scope}-${record.emissions}`;

      if (!seen.has(key) && this.isValidRecord(record)) {
        seen.add(key);
        validRecords.push(record);
      }
    }

    return validRecords;
  }

  /**
   * Validate emission record
   */
  isValidRecord(record) {
    return (
      record.company &&
      record.year &&
      record.emissions > 0 &&
      record.emissions < 1000000 && // Reasonable upper bound
      ['Scope 1', 'Scope 2', 'Scope 3', 'Total'].includes(record.scope)
    );
  }

  /**
   * Generate extraction report
   */
  async generateExtractionReport() {
    const report = {
      timestamp: new Date().toISOString(),
      egyptExtraction: {
        ...this.processingStats,
        companiesFound: [...new Set(this.extractedData.map(r => r.company))],
        yearDistribution: this.getYearDistribution(),
        scopeDistribution: this.getScopeDistribution(),
        averageEmissions: this.calculateAverageEmissions()
      }
    };

    await fs.writeFile(CONFIG.logFile, JSON.stringify(report, null, 2));
    console.log(`📋 Extraction report saved to: ${CONFIG.logFile}`);
  }

  /**
   * Combine with existing global data
   */
  async combineWithExistingData() {
    console.log('\n🔗 Combining Egyptian data with existing global dataset...');

    try {
      // Read existing data
      const existingData = await this.readExistingData();

      // Combine datasets
      const combinedData = [...existingData, ...this.extractedData];

      // Remove duplicates across datasets
      const uniqueData = this.removeCrossDatasetDuplicates(combinedData);

      // Sort by company and year
      uniqueData.sort((a, b) => {
        if (a.company !== b.company) return a.company.localeCompare(b.company);
        return parseInt(a.year) - parseInt(b.year);
      });

      // Write combined CSV
      await this.writeCombinedCsv(uniqueData);

      console.log(`✅ Combined dataset created: ${uniqueData.length} total records`);
      console.log(`   - Existing records: ${existingData.length}`);
      console.log(`   - New Egyptian records: ${this.extractedData.length}`);
      console.log(`   - Final unique records: ${uniqueData.length}`);

    } catch (error) {
      console.error('Error combining datasets:', error);
      throw error;
    }
  }

  /**
   * Read existing emissions data
   */
  async readExistingData() {
    try {
      const csvContent = await fs.readFile(CONFIG.existingDataFile, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());

      if (lines.length < 2) return [];

      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      const records = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
        if (values.length === headers.length) {
          const record = {};
          headers.forEach((header, index) => {
            record[header] = values[index];
          });
          records.push(record);
        }
      }

      return records;
    } catch (error) {
      console.warn('Could not read existing data file, starting fresh:', error.message);
      return [];
    }
  }

  /**
   * Remove duplicates across datasets
   */
  removeCrossDatasetDuplicates(records) {
    const seen = new Set();
    const uniqueRecords = [];

    for (const record of records) {
      // Create a unique key considering all relevant fields
      const key = `${record.company || ''}-${record.year || ''}-${record.scope || ''}-${record.emissions || ''}`.toLowerCase();

      if (!seen.has(key)) {
        seen.add(key);
        uniqueRecords.push(record);
      }
    }

    return uniqueRecords;
  }

  /**
   * Write combined CSV with professional formatting
   */
  async writeCombinedCsv(records) {
    const csvWriter = createObjectCsvWriter({
      path: CONFIG.newDataFile,
      header: [
        { id: 'company', title: 'Company' },
        { id: 'year', title: 'Year' },
        { id: 'scope', title: 'Scope' },
        { id: 'emissions', title: 'Emissions (MT CO2e)' },
        { id: 'unit', title: 'Unit' },
        { id: 'country', title: 'Country' },
        { id: 'source', title: 'Data Source' },
        { id: 'pdf_file', title: 'Source File' },
        { id: 'extraction_method', title: 'Extraction Method' },
        { id: 'confidence', title: 'Confidence Score' }
      ]
    });

    // Ensure all records have required fields
    const formattedRecords = records.map(record => ({
      company: record.company || 'Unknown',
      year: record.year || 'Unknown',
      scope: record.scope || 'Total',
      emissions: parseFloat(record.emissions) || 0,
      unit: record.unit || 'MT CO2e',
      country: record.country || 'Unknown',
      source: record.source || 'Unknown',
      pdf_file: record.pdf_file || 'Unknown',
      extraction_method: record.extraction_method || 'Unknown',
      confidence: parseFloat(record.confidence) || 0.5
    }));

    await csvWriter.writeRecords(formattedRecords);

    console.log(`💾 Combined CSV saved to: ${CONFIG.newDataFile}`);
  }

  // Utility methods for statistics
  getYearDistribution() {
    const distribution = {};
    this.extractedData.forEach(record => {
      distribution[record.year] = (distribution[record.year] || 0) + 1;
    });
    return distribution;
  }

  getScopeDistribution() {
    const distribution = {};
    this.extractedData.forEach(record => {
      distribution[record.scope] = (distribution[record.scope] || 0) + 1;
    });
    return distribution;
  }

  calculateAverageEmissions() {
    if (this.extractedData.length === 0) return 0;
    const sum = this.extractedData.reduce((acc, record) => acc + (parseFloat(record.emissions) || 0), 0);
    return sum / this.extractedData.length;
  }
}

// Main execution
async function main() {
  const extractor = new EgyptEmissionsExtractor();
  await extractor.extractEgyptData();
}

// Run if called directly
main().catch(console.error);

export { EgyptEmissionsExtractor };
