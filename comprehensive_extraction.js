#!/usr/bin/env node

/**
 * 🚀 COMPREHENSIVE PDF EMISSIONS EXTRACTION
 *
 * Extracts emissions data from ALL PDFs in downloads folder
 * Processes both regular and Egyptian sustainability reports
 * Creates unified dataset with all real records
 *
 * USAGE:
 *   node comprehensive_extraction.js
 */

import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log(`__dirname: ${__dirname}`);

// Configuration
const CONFIG = {
  downloadsDir: path.join(__dirname, 'downloads'),
  egyptDir: path.join(__dirname, 'downloads', 'Egypt Sustainability Reports'),
  outputFile: path.join(__dirname, 'output', 'comprehensive_emissions_dataset.csv'),
  logFile: path.join(__dirname, 'output', 'comprehensive_extraction_log.json')
};
console.log(`CONFIG.downloadsDir: ${CONFIG.downloadsDir}`);
console.log(`CONFIG.egyptDir: ${CONFIG.egyptDir}`);

class ComprehensiveExtractor {
  constructor() {
    this.allRecords = [];
    this.extractionStats = {
      totalPDFs: 0,
      processedPDFs: 0,
      successfulExtractions: 0,
      totalRecords: 0,
      errors: []
    };
  }

  /**
   * Main extraction workflow
   */
  async extractAllEmissionsData() {
    console.log('🚀 COMPREHENSIVE PDF EMISSIONS EXTRACTION');
    console.log('='.repeat(60));

    try {
      // Get all PDF files
      const allPDFs = await this.getAllPDFFiles();
      this.extractionStats.totalPDFs = allPDFs.length;

      console.log(`📂 Found ${allPDFs.length} PDF files to process`);
      console.log(`🇪🇬 Egyptian PDFs: ${allPDFs.filter(p => p.isEgypt).length}`);
      console.log(`🌍 Global PDFs: ${allPDFs.filter(p => !p.isEgypt).length}`);
      console.log('');

      // Process each PDF
      for (let i = 0; i < allPDFs.length; i++) {
        const pdfInfo = allPDFs[i];
        console.log(`${i + 1}/${allPDFs.length}: Processing ${path.basename(pdfInfo.path)}`);

        try {
          const records = await this.processSinglePDF(pdfInfo);
          if (records.length > 0) {
            this.allRecords.push(...records);
            this.extractionStats.successfulExtractions++;
            console.log(`   ✅ Extracted ${records.length} records`);
          } else {
            console.log(`   ⚠️  No emissions data found`);
          }
        } catch (error) {
          console.log(`   ❌ Error: ${error.message}`);
          this.extractionStats.errors.push({
            file: pdfInfo.path,
            error: error.message
          });
        }

        this.extractionStats.processedPDFs++;
      }

      // Remove duplicates and clean data
      await this.cleanAndDeduplicate();

      // Generate final output
      await this.generateFinalOutput();

      // Generate report
      await this.generateReport();

      console.log('\n✅ Comprehensive extraction completed!');
      console.log(`📊 Total records extracted: ${this.extractionStats.totalRecords}`);
      console.log(`📄 Successful PDFs: ${this.extractionStats.successfulExtractions}/${this.extractionStats.totalPDFs}`);
      console.log(`💾 Output saved: ${CONFIG.outputFile}`);

    } catch (error) {
      console.error('❌ Comprehensive extraction failed:', error);
      throw error;
    }
  }

  /**
   * Get all PDF files from both directories
   */
  async getAllPDFFiles() {
    const allPDFs = [];

    // Get regular PDFs
    try {
      const regularFiles = await fs.readdir(CONFIG.downloadsDir);
      console.log(`regularFiles: ${JSON.stringify(regularFiles)}`);
      for (const file of regularFiles) {
        if (file.toLowerCase().endsWith('.pdf')) {
          allPDFs.push({
            path: path.join(CONFIG.downloadsDir, file),
            isEgypt: false,
            filename: file
          });
        }
      }
    } catch (error) {
      console.warn('Warning: Could not read downloads directory:', error.message);
    }

    // Get Egyptian PDFs
    try {
      const egyptFiles = await fs.readdir(CONFIG.egyptDir);
      console.log(`egyptFiles: ${JSON.stringify(egyptFiles)}`);
      for (const file of egyptFiles) {
        if (file.toLowerCase().endsWith('.pdf')) {
          allPDFs.push({
            path: path.join(CONFIG.egyptDir, file),
            isEgypt: true,
            filename: file
          });
        }
      }
    } catch (error) {
      console.warn('Warning: Could not read Egypt directory:', error.message);
    }
    console.log(`allPDFs: ${JSON.stringify(allPDFs)}`);
    return allPDFs;
  }

  /**
   * Process a single PDF file
   */
  async processSinglePDF(pdfInfo) {
    const records = [];

    try {
      // Read PDF
      const dataBuffer = await fs.readFile(pdfInfo.path);
      const pdfData = await pdfParse(dataBuffer);
      const text = pdfData.text;

      // Extract company name from filename
      const companyName = this.extractCompanyFromFilename(pdfInfo.filename);

      // Use appropriate extraction method
      if (pdfInfo.isEgypt) {
        const egyptRecords = this.extractEgyptianEmissions(text, companyName, pdfInfo.filename);
        records.push(...egyptRecords);
      } else {
        const globalRecords = this.extractGlobalEmissions(text, companyName, pdfInfo.filename);
        records.push(...globalRecords);
      }

    } catch (error) {
      // Try alternative extraction if main method fails
      console.log(`   🔄 Trying alternative extraction for ${pdfInfo.filename}`);
      try {
        const altRecords = await this.extractWithAlternativeMethod(pdfInfo);
        records.push(...altRecords);
      } catch (altError) {
        throw new Error(`PDF parsing failed: ${error.message}`);
      }
    }

    return records;
  }

  /**
   * Extract company name from filename
   */
  extractCompanyFromFilename(filename) {
    // Remove file extension and common prefixes
    let company = filename.replace(/\.pdf$/i, '');

    // Remove timestamps and IDs
    company = company.replace(/^\d+_/, '');
    company = company.replace(/_\d+$/, '');
    company = company.replace(/^\d+/, '');

    // Clean up special characters and underscores
    company = company.replace(/[-_]/g, ' ');
    company = company.replace(/%2520/g, ' '); // URL encoded spaces

    // Capitalize words
    company = company.replace(/\b\w/g, l => l.toUpperCase());

    // Common company name mappings
    const companyMappings = {
      'Abn Amro': 'ABN AMRO Bank NV',
      'Apple Environmental': 'Apple Inc.',
      'Google': 'Google LLC',
      'Microsoft Environmental': 'Microsoft Corporation',
      'Tesla Impact': 'Tesla Inc.',
      'Ccep Annual': 'Coca-Cola Europacific Partners',
      'Heineken N V': 'Heineken NV',
      'Ing Annual': 'ING Group',
      'Kpn Integrated': 'KPN',
      'Philips Full': 'Philips',
      'Signify Annual': 'Signify',
      'Vodafone Ziggo': 'VodafoneZiggo',
      'Burg Mvo Csr': 'Burg Group',
      'Ah Duurzaamheidsverslag': 'Albert Heijn',
      'Hema Sustainability': 'HEMA',
      'Nn Group Annual': 'NN Group',
      'Bugaboo Impact': 'Bugaboo',
      'Cb Annual': 'CB Group',
      'Royal Avebe': 'Royal Avebe',
      'Dfx Sustain': 'DFX',
      'Trivium Packaging': 'Trivium Packaging',
      'Tarkett Urd': 'Tarkett',
      'View Annual': 'View Inc.',
      'Vanlanschotkempen Annual': 'Van Lanschot Kempen',
      'Renew Annual': 'ReNew Power',
      'Ioc Sustainability': 'Indian Oil Corporation',
      'Lseg Sustainability': 'London Stock Exchange Group',
      'Stg Sr': 'STG Group',
      'Optigroup Ar': 'OptiGroup',
      'Citizenship Report': 'Various Companies',
      'Sustainability Report': 'Various Companies',
      'Annual Report': 'Various Companies',
      'Impact Report': 'Various Companies',
      'Esg Report': 'Various Companies'
    };

    // Apply mappings
    for (const [pattern, mappedName] of Object.entries(companyMappings)) {
      if (company.toLowerCase().includes(pattern.toLowerCase())) {
        return mappedName;
      }
    }

    // For Egyptian companies, use specific mappings
    if (company.toLowerCase().includes('etisalat')) return 'Etisalat Egypt';
    if (company.toLowerCase().includes('vodafone egypt')) return 'Vodafone Egypt';
    if (company.toLowerCase().includes('banque misr')) return 'Banque Misr';
    if (company.toLowerCase().includes('saib')) return 'Société Arabe Internationale de Banque';
    if (company.toLowerCase().includes('hawkamah')) return 'Hawkamah - The UAE Institute for Corporate Governance';

    return company || 'Unknown Company';
  }

  /**
   * Extract emissions from Egyptian PDFs
   */
  extractEgyptianEmissions(text, company, filename) {
    const records = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);

    // Enhanced Egyptian patterns
    const patterns = [
      // Direct emissions values with scopes
      /(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:MT|tonnes?|kg)\s*CO2e?\s*(?:emissions?)?\s*(?:Scope\s*([123])|Total)/gi,
      // Values followed by emission types
      /(?:Scope\s*([123])|Total)\s*(?:emissions?|GHG)?\s*:?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:MT|tonnes?|kg)\s*CO2e?/gi,
      // Table-like formats
      /(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:MT|tonnes?|kg)\s*CO2e?\s*\|\s*(?:Scope\s*([123])|Total)/gi,
      // Arabic number formats
      /(\d+(?:\.\d+)?)\s*(?:طن|مليون طن)\s*(?:مكافئ ثاني أكسيد الكربون|CO2e)/gi
    ];

    for (const line of lines) {
      for (const pattern of patterns) {
        const matches = [...line.matchAll(pattern)];
        for (const match of matches) {
          const value = match[1] || match[2];
          const scope = match[3] || 'Total';

          if (value && !isNaN(parseFloat(value.replace(/,/g, '')))) {
            records.push({
              Company: company,
              Year: this.extractYear(text, filename) || '2023',
              Scope: scope === '1' ? 'Scope 1' : scope === '2' ? 'Scope 2' : scope === '3' ? 'Scope 3' : 'Total',
              Emissions: parseFloat(value.replace(/,/g, '')),
              'GHG Unit': 'MT CO2e',
              Country: 'Egypt',
              'Data Source': 'Egypt Sustainability Reports',
              'Source File': filename,
              'Confidence Score': 0.8
            });
          }
        }
      }
    }

    return records;
  }

  /**
   * Extract emissions from global PDFs
   */
  extractGlobalEmissions(text, company, filename) {
    const records = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);

    // Global emissions patterns
    const patterns = [
      // Standard emissions formats
      /(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:MT|tonnes?|kg|million)\s*CO2e?\s*(?:emissions?)?\s*(?:Scope\s*([123])|Total)/gi,
      // Values with units first
      /(?:Scope\s*([123])|Total)\s*(?:emissions?|GHG)?\s*:?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:MT|tonnes?|kg)\s*CO2e?/gi,
      // Table formats
      /(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:MT|tonnes?|kg)\s*CO2e?\s*\|\s*(?:Scope\s*([123])|Total)/gi,
      // Year-specific patterns
      /(?:202[0-9]|201[0-9])\s*:?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:MT|tonnes?|kg)\s*CO2e?/gi
    ];

    for (const line of lines) {
      for (const pattern of patterns) {
        const matches = [...line.matchAll(pattern)];
        for (const match of matches) {
          const value = match[1] || match[2];
          const scope = match[3] || 'Total';

          if (value && !isNaN(parseFloat(value.replace(/,/g, '')))) {
            records.push({
              Company: company,
              Year: this.extractYear(text, filename) || '2024',
              Scope: scope === '1' ? 'Scope 1' : scope === '2' ? 'Scope 2' : scope === '3' ? 'Scope 3' : 'Total',
              Emissions: parseFloat(value.replace(/,/g, '')),
              'GHG Unit': 'MT CO2e',
              Country: this.guessCountry(company, filename),
              'Data Source': 'Global Sustainability Reports',
              'Source File': filename,
              'Confidence Score': 0.7
            });
          }
        }
      }
    }

    return records;
  }

  /**
   * Alternative extraction method for problematic PDFs
   */
  async extractWithAlternativeMethod(pdfInfo) {
    // This could implement OCR or other extraction methods
    // For now, return empty array
    return [];
  }

  /**
   * Extract year from text or filename
   */
  extractYear(text, filename) {
    // Try to find year in filename
    const yearMatch = filename.match(/(?:20|19)(\d{2})/);
    if (yearMatch) {
      const year = parseInt('20' + yearMatch[1]);
      if (year >= 2010 && year <= 2030) return year.toString();
    }

    // Try to find year in text
    const textYears = text.match(/\b(20\d{2})\b/g);
    if (textYears) {
      const validYears = textYears.filter(y => parseInt(y) >= 2010 && parseInt(y) <= 2030);
      if (validYears.length > 0) {
        return validYears[validYears.length - 1]; // Return most recent
      }
    }

    return null;
  }

  /**
   * Guess country from company name or filename
   */
  guessCountry(company, filename) {
    const lowerCompany = company.toLowerCase();
    const lowerFilename = filename.toLowerCase();

    // Netherlands
    if (lowerCompany.includes('heineken') || lowerCompany.includes('abn amro') ||
        lowerCompany.includes('ing') || lowerCompany.includes('kpn') ||
        lowerCompany.includes('philips') || lowerCompany.includes('ah ') ||
        lowerCompany.includes('hema') || lowerCompany.includes('bugaboo') ||
        lowerCompany.includes('avebe') || lowerCompany.includes('dfx')) {
      return 'Netherlands';
    }

    // Belgium
    if (lowerCompany.includes('van lanschot') || lowerCompany.includes('kempen')) {
      return 'Belgium';
    }

    // United States
    if (lowerCompany.includes('apple') || lowerCompany.includes('google') ||
        lowerCompany.includes('microsoft') || lowerCompany.includes('tesla') ||
        lowerCompany.includes('view')) {
      return 'United States';
    }

    // United Kingdom
    if (lowerCompany.includes('burberry') || lowerCompany.includes('lseg') ||
        lowerCompany.includes('london stock exchange')) {
      return 'United Kingdom';
    }

    // Germany
    if (lowerCompany.includes('tarkett')) {
      return 'Germany';
    }

    // India
    if (lowerCompany.includes('renew') || lowerCompany.includes('indian oil')) {
      return 'India';
    }

    // Egypt (already handled)
    if (lowerFilename.includes('egypt') || lowerCompany.includes('etisalat') ||
        lowerCompany.includes('vodafone egypt') || lowerCompany.includes('banque misr')) {
      return 'Egypt';
    }

    return 'Unknown';
  }

  /**
   * Clean and deduplicate records
   */
  async cleanAndDeduplicate() {
    console.log('\n🧹 Cleaning and deduplicating records...');

    // Remove duplicates based on company, year, scope, and emissions
    const seen = new Set();
    const uniqueRecords = [];

    for (const record of this.allRecords) {
      const key = `${record.Company}|${record.Year}|${record.Scope}|${record.Emissions}|${record.Country}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueRecords.push(record);
      }
    }

    // Filter out invalid records
    const validRecords = uniqueRecords.filter(record =>
      record.Company &&
      record.Company !== 'Unknown Company' &&
      record.Emissions > 0 &&
      record.Emissions < 1000000 // Reasonable upper bound
    );

    this.allRecords = validRecords;
    this.extractionStats.totalRecords = validRecords.length;

    console.log(`✅ Deduplicated: ${uniqueRecords.length} unique records`);
    console.log(`✅ Valid records: ${validRecords.length}`);
  }

  /**
   * Generate final CSV output
   */
  async generateFinalOutput() {
    console.log('\n💼 Generating final comprehensive dataset...');

    const csvWriter = createObjectCsvWriter({
      path: CONFIG.outputFile,
      header: [
        { id: 'Company', title: 'Company' },
        { id: 'Year', title: 'Year' },
        { id: 'Scope', title: 'Scope' },
        { id: 'Emissions', title: 'Emissions' },
        { id: 'GHG Unit', title: 'GHG Unit' },
        { id: 'Country', title: 'Country' },
        { id: 'Data Source', title: 'Data Source' }
      ]
    });

    await csvWriter.writeRecords(this.allRecords);
    console.log(`💾 Comprehensive dataset saved: ${CONFIG.outputFile}`);
  }

  /**
   * Generate extraction report
   */
  async generateReport() {
    const report = {
      extraction_summary: this.extractionStats,
      dataset_summary: {
        total_records: this.allRecords.length,
        countries: [...new Set(this.allRecords.map(r => r.Country))],
        companies: [...new Set(this.allRecords.map(r => r.Company))].length,
        year_range: {
          min: Math.min(...this.allRecords.map(r => parseInt(r.Year) || 2024)),
          max: Math.max(...this.allRecords.map(r => parseInt(r.Year) || 2024))
        }
      },
      top_companies: this.allRecords.reduce((acc, record) => {
        acc[record.Company] = (acc[record.Company] || 0) + 1;
        return acc;
      }, {}),
      generated_at: new Date().toISOString()
    };

    await fs.writeFile(CONFIG.logFile, JSON.stringify(report, null, 2));
    console.log(`📊 Extraction report saved: ${CONFIG.logFile}`);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const extractor = new ComprehensiveExtractor();
  extractor.extractAllEmissionsData().catch(console.error);
}

export default ComprehensiveExtractor;
