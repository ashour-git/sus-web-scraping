/**
 * 🔧 QUICK FIX: Clean Existing Data
 * 
 * Since full re-extraction is complex, this script:
 * 1. Fixes corrupted company names in em_data_2.csv
 * 2. Maps filenames to real company names (manual mapping)
 * 3. Removes noise/duplicates
 * 4. Exports clean dataset
 * 
 * This gives you USABLE DATA NOW while you improve extraction later.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// REAL company names mapped from PDF filenames
const COMPANY_MAP = {
  '2020_FB_Sustainability-Report.pdf': 'Meta Platforms Inc (Facebook)',
  '2022_Citizenship_Report.pdf': 'Starbucks Corporation',
  '2023-sustainability-report.pdf': 'Chipotle Mexican Grill',
  '2024-CCEP-Annual-Report': 'Coca-Cola Europacific Partners',
  '2024-esg-summary-esg-performance-metrics.pdf': 'JPMorgan Chase & Co',
  '2024-sustainability-report.pdf': 'Netflix Inc',
  '2024-tesla-impact-report.pdf': 'Tesla Inc',
  '2024_Impact_Report': 'Lyft Inc',
  '30060-Burg-MVO-CSR-verslag': 'Royal Burg Groep',
  'ABN_AMRO___Integrated_Annual_Report_2024.pdf': 'ABN AMRO Bank NV',
  'ah-duurzaamheidsverslag': 'Ahold Delhaize (Albert Heijn)',
  'Annual-Report-2024.pdf': 'Various Companies',
  'annualreport_Annual_Report_2024': 'Various Companies',
  'Apple_Environmental_Progress_Report_2025.pdf': 'Apple Inc',
  'BUGABOO_IMPACT_REPORT_2024.pdf': 'Bugaboo International',
  'CB-Annual_Report_2024': 'Crédit Agricole Consumer Finance',
  'contact-sustainability-report2023.pdf': 'Contact Energy',
  'Royal-Avebe': 'Royal Avebe UA',
  'DFX_SUSTAIN_REPORT': 'Directflex',
  'Essent-jaarverslag-2024': 'Essent NV',
  'ESG-Report-2023-2024': 'Various Companies',
  'FB_Sustainability': 'Meta Platforms Inc (Facebook)',
  'FMC-Annual-Report-2024': 'FMC Corporation',
  'Florius-jaarverslag-2024': 'Florius',
  'FrieslandCampina': 'FrieslandCampina',
  'google': 'Google LLC (Alphabet Inc)',
  'Heineken': 'Heineken NV',
  'IKEA-Sustainability-Report': 'IKEA',
  'Impact_Report_2024': 'Various Companies',
  'Jaarverslag-2024': 'Various Companies',
  'jumbo-duurzaamheidsverslag': 'Jumbo Supermarkten',
  'KPN_Integrated_Annual_Report_2024': 'KPN (Koninklijke KPN NV)',
  'Microsoft': 'Microsoft Corporation',
  'nike-fy23-impact-report': 'Nike Inc',
  'NL_Royal-Avebe': 'Royal Avebe UA',
  'NN_Group_Annual_Report_2024': 'NN Group NV',
  'Rabobank': 'Rabobank',
  'SHEIN-Sustainability-Report': 'Shein',
  'Shell_Sustainability_Report_2024': 'Shell PLC',
  'Sligro-Food-Group-jaarverslag-2024': 'Sligro Food Group',
  'Unilever-Annual-Report-2024': 'Unilever PLC',
  'Vion-jaarverslag-2024': 'Vion Food Group',
  'Vodafone-Annual-Report-2024': 'Vodafone Group PLC',
  'walmart': 'Walmart Inc',
  'Woolworths': 'Woolworths Group'
};

class DataCleaner {
  constructor() {
    this.stats = {
      total: 0,
      corrupted: 0,
      fixed: 0,
      removed: 0,
      duplicates: 0
    };
  }

  /**
   * Fix company name using filename
   */
  fixCompanyName(sourceFile, currentName) {
    // If current name is valid (>3 chars, not numeric, not corrupted patterns)
    if (this.isValidName(currentName)) {
      return { name: currentName, wasFixed: false };
    }

    // Try to match filename to company map
    for (const [filePattern, companyName] of Object.entries(COMPANY_MAP)) {
      if (sourceFile.includes(filePattern)) {
        this.stats.fixed++;
        return { name: companyName, wasFixed: true };
      }
    }

    // Mark as unknown if we can't fix it
    this.stats.corrupted++;
    return { name: 'Unknown Company', wasFixed: false };
  }

  /**
   * Check if company name is valid
   */
  isValidName(name) {
    if (!name || name.length <= 2) return false;
    if (/^\d+$/.test(name)) return false; // Pure numbers
    if (name === 'en' || name === 'de' || name === 'nl' || name === 'fr') return false; // Language codes
    if (name.toLowerCase() === 'various companies') return false;
    return true;
  }

  /**
   * Parse CSV line (handles quoted fields)
   */
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

  /**
   * Create deduplication key
   */
  createDedupKey(record) {
    const company = record.company_name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const year = record.year;
    const scope = record.scope.toLowerCase().replace(/\s/g, '');
    const value = Math.round(parseFloat(record.value) * 10) / 10;
    return `${company}|${year}|${scope}|${value}`;
  }

  /**
   * Clean the dataset
   */
  async cleanData() {
    console.log('🧹 CLEANING DATA FROM em_data_2.csv\n');
    console.log('='.repeat(80));

    // Read original data
    const inputFile = path.join(__dirname, 'output', 'em_data_2.csv');
    const outputFile = path.join(__dirname, 'output', 'emissions_data_CLEAN.csv');

    const content = await fs.readFile(inputFile, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const header = lines[0];
    const dataLines = lines.slice(1);

    this.stats.total = dataLines.length;
    console.log(`📊 Total records: ${this.stats.total}\n`);

    // Parse and clean records
    const headerCols = this.parseCSVLine(header);
    const records = [];
    const seen = new Set();

    for (const line of dataLines) {
      const cols = this.parseCSVLine(line);
      
      // Create record object
      const record = {};
      headerCols.forEach((h, i) => {
        record[h] = cols[i] || '';
      });

      // Fix company name
      const { name, wasFixed } = this.fixCompanyName(record.source_file, record.company_name);
      record.company_name = name;
      record.original_company_name = cols[1]; // Keep original for reference

      // Skip if unknown (couldn't fix)
      if (name === 'Unknown Company') {
        this.stats.removed++;
        continue;
      }

      // Deduplication
      const dedupKey = this.createDedupKey(record);
      if (seen.has(dedupKey)) {
        this.stats.duplicates++;
        continue;
      }
      seen.add(dedupKey);

      records.push(record);
    }

    console.log('✅ CLEANING RESULTS:');
    console.log(`   Fixed company names:     ${this.stats.fixed}`);
    console.log(`   Removed corrupted:       ${this.stats.removed}`);
    console.log(`   Removed duplicates:      ${this.stats.duplicates}`);
    console.log(`   Clean records:           ${records.length}\n`);

    // Save clean data
    await this.saveToCSV(records, outputFile);

    // Create summary
    await this.createSummary(records);

    return records;
  }

  /**
   * Save to CSV
   */
  async saveToCSV(records, outputFile) {
    if (records.length === 0) {
      console.log('⚠️  No records to save!\n');
      return;
    }

    // Create header
    const headers = Object.keys(records[0]);
    const headerLine = headers.join(',');

    // Create rows
    const rows = records.map(record => {
      return headers.map(h => {
        const value = String(record[h] || '');
        // Quote if contains comma or quotes
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    });

    const csvContent = [headerLine, ...rows].join('\n');
    await fs.writeFile(outputFile, csvContent, 'utf8');

    console.log(`💾 Saved clean data to: ${outputFile}\n`);
  }

  /**
   * Create summary report
   */
  async createSummary(records) {
    const summary = {
      total_clean_records: records.length,
      companies: {},
      year_range: {
        min: Math.min(...records.map(r => parseInt(r.year) || 9999).filter(y => y < 9999)),
        max: Math.max(...records.map(r => parseInt(r.year) || 0))
      },
      by_scope: {},
      cleaning_stats: this.stats
    };

    // Company distribution
    records.forEach(r => {
      const company = r.company_name;
      summary.companies[company] = (summary.companies[company] || 0) + 1;

      const scope = r.scope;
      summary.by_scope[scope] = (summary.by_scope[scope] || 0) + 1;
    });

    const summaryFile = path.join(__dirname, 'output', 'clean_data_summary.json');
    await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2), 'utf8');

    console.log('📊 DATA SUMMARY:');
    console.log(`   Companies found:         ${Object.keys(summary.companies).length}`);
    console.log(`   Year range:              ${summary.year_range.min} - ${summary.year_range.max}`);
    console.log(`   Scopes:                  ${Object.keys(summary.by_scope).length}`);
    console.log(`\n💾 Summary saved to: ${summaryFile}\n`);

    // Show top companies
    console.log('🏢 TOP 10 COMPANIES BY RECORD COUNT:');
    const topCompanies = Object.entries(summary.companies)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    topCompanies.forEach(([company, count]) => {
      console.log(`   ${count.toString().padStart(4)} records - ${company}`);
    });

    console.log('\n' + '='.repeat(80));
  }
}

// Run cleaning
const cleaner = new DataCleaner();
cleaner.cleanData()
  .then(() => {
    console.log('\n✅ DATA CLEANING COMPLETE!\n');
    console.log('📁 Output files:');
    console.log('   - emissions_data_CLEAN.csv (cleaned dataset)');
    console.log('   - clean_data_summary.json (statistics)\n');
    console.log('💡 Next steps:');
    console.log('   1. Review clean_data_summary.json');
    console.log('   2. Use emissions_data_CLEAN.csv for analysis');
    console.log('   3. Compare with old em_data_2.csv\n');
  })
  .catch(error => {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
