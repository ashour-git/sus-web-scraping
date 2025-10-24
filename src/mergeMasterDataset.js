import fs from 'fs/promises';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

/**
 * Master Dataset Merger
 * 
 * Merges multiple data sources into a single professional CSV:
 * - ULTRATHINK scraped data (3,252 records from PDFs)
 * - CDP API data (structured emissions data)
 * 
 * Features:
 * - Deduplication
 * - Data quality scoring
 * - Source attribution
 * - Unit standardization
 */
class MasterDatasetMerger {
  constructor() {
    this.sources = {
      ultrathink: 'output/emissions_data.csv',  // ULTRATHINK CSV (CSVWriter uses config path)
      cdpApi: 'output/emissions_data_cdp_api.csv'
    };
    this.outputFile = 'output/emissions_data_MASTER.csv';
  }

  /**
   * Load data from a CSV file
   */
  async loadCSV(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true
      });
      console.log(`  ✅ Loaded ${records.length} records from ${filePath}`);
      return records;
    } catch (error) {
      console.log(`  ⚠️  File not found: ${filePath}`);
      return [];
    }
  }

  /**
   * Standardize units across all records
   */
  standardizeUnits(records) {
    console.log('\n🔧 Standardizing units...');
    
    const unitConversions = {
      'kg CO2e': { multiplier: 0.001, standard: 'tonnes CO2e' },
      'kg': { multiplier: 0.001, standard: 'tonnes CO2e' },
      'metric tons CO2e': { multiplier: 1, standard: 'tonnes CO2e' },
      'metric tons': { multiplier: 1, standard: 'tonnes CO2e' },
      'tons': { multiplier: 1, standard: 'tonnes CO2e' },
      't CO2e': { multiplier: 1, standard: 'tonnes CO2e' },
      'tCO2e': { multiplier: 1, standard: 'tonnes CO2e' },
      'MT CO2e': { multiplier: 1000000, standard: 'tonnes CO2e' },
      'million tonnes': { multiplier: 1000000, standard: 'tonnes CO2e' },
      'kt CO2e': { multiplier: 1000, standard: 'tonnes CO2e' },
      'kilotons': { multiplier: 1000, standard: 'tonnes CO2e' }
    };

    let standardized = 0;
    records.forEach(record => {
      const unit = record.Unit || record.unit || '';
      const conversion = unitConversions[unit];
      
      if (conversion) {
        const value = parseFloat(record.Value || record.value || 0);
        record.Value = (value * conversion.multiplier).toFixed(2);
        record.Unit = conversion.standard;
        standardized++;
      } else if (!unit || unit === 'inferred') {
        record.Unit = 'tonnes CO2e';
      }
    });

    console.log(`  ✅ Standardized ${standardized} records to tonnes CO2e`);
    return records;
  }

  /**
   * Deduplicate records
   * Priority: CDP API > ULTRATHINK (API data is verified)
   */
  deduplicateRecords(records) {
    console.log('\n🔍 Deduplicating records...');
    
    const seen = new Map();
    const deduplicated = [];
    let removed = 0;

    // Sort by data quality (High > Medium > Low)
    const qualityOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };
    records.sort((a, b) => {
      const qA = qualityOrder[a['Data Quality']] || 3;
      const qB = qualityOrder[b['Data Quality']] || 3;
      return qA - qB;
    });

    records.forEach(record => {
      const key = `${record.Company}|${record.Year}|${record.Scope}`;
      
      if (!seen.has(key)) {
        seen.set(key, true);
        deduplicated.push(record);
      } else {
        removed++;
      }
    });

    console.log(`  ✅ Removed ${removed} duplicates`);
    console.log(`  ✅ Kept ${deduplicated.length} unique records`);
    
    return deduplicated;
  }

  /**
   * Add data quality scores
   */
  scoreDataQuality(records) {
    console.log('\n📊 Scoring data quality...');
    
    records.forEach(record => {
      let score = 0;
      
      // Already has quality from source?
      if (record['Data Quality'] === 'High') {
        score = 90;
      } else if (record['Data Quality'] === 'Medium') {
        score = 70;
      } else if (record['Data Quality'] === 'Low') {
        score = 50;
      } else {
        // Calculate from confidence
        const confidence = parseFloat(record.Confidence || 0) * 100;
        score = confidence;
      }

      // Boost for verified data
      if (record.Verified === 'Yes') {
        score = Math.min(100, score + 10);
      }

      // Boost for API sources
      if (record.Source && record.Source.includes('API')) {
        score = Math.min(100, score + 5);
      }

      record['Quality Score'] = Math.round(score);
      
      // Assign quality tier
      if (score >= 80) {
        record['Data Quality'] = 'High';
      } else if (score >= 60) {
        record['Data Quality'] = 'Medium';
      } else {
        record['Data Quality'] = 'Low';
      }
    });

    console.log('  ✅ Quality scores assigned');
  }

  /**
   * Normalize record structure
   */
  normalizeRecords(records, source) {
    return records.map(record => ({
      Company: record.Company || '',
      Year: parseInt(record.Year || 0),
      Scope: record.Scope || '',
      Category: record.Category || '',
      Value: parseFloat(record.Value || 0),
      Unit: record.Unit || 'tonnes CO2e',
      'Data Quality': record['Data Quality'] || 'Medium',
      Source: record.Source || source,
      Verified: record.Verified || 'No',
      Confidence: record.Confidence || '',
      Method: record.Method || '',
      'Raw Text': record['Raw Text'] || '',
      'Source File': record['Source File'] || ''
    }));
  }

  /**
   * Generate comprehensive analytics
   */
  generateAnalytics(records) {
    console.log('\n' + '='.repeat(70));
    console.log('📊 MASTER DATASET ANALYTICS');
    console.log('='.repeat(70));

    console.log(`\n✅ Total Records: ${records.length}`);

    // By source
    const bySources = {};
    records.forEach(r => {
      const src = r.Source || 'Unknown';
      bySources[src] = (bySources[src] || 0) + 1;
    });
    console.log(`\n📁 By Source:`);
    Object.entries(bySources)
      .sort((a, b) => b[1] - a[1])
      .forEach(([source, count]) => {
        const pct = ((count / records.length) * 100).toFixed(1);
        console.log(`   • ${source}: ${count} (${pct}%)`);
      });

    // By quality
    const byQuality = {};
    records.forEach(r => {
      const quality = r['Data Quality'] || 'Unknown';
      byQuality[quality] = (byQuality[quality] || 0) + 1;
    });
    console.log(`\n⭐ By Data Quality:`);
    Object.entries(byQuality)
      .sort((a, b) => b[1] - a[1])
      .forEach(([quality, count]) => {
        const pct = ((count / records.length) * 100).toFixed(1);
        console.log(`   • ${quality}: ${count} (${pct}%)`);
      });

    // By scope
    const byScope = {};
    records.forEach(r => {
      const scope = r.Scope || 'Unknown';
      byScope[scope] = (byScope[scope] || 0) + 1;
    });
    console.log(`\n🎯 By Scope:`);
    Object.entries(byScope)
      .sort((a, b) => b[1] - a[1])
      .forEach(([scope, count]) => {
        const pct = ((count / records.length) * 100).toFixed(1);
        console.log(`   • ${scope}: ${count} (${pct}%)`);
      });

    // By year
    const byYear = {};
    records.forEach(r => {
      const year = r.Year || 'Unknown';
      byYear[year] = (byYear[year] || 0) + 1;
    });
    console.log(`\n📅 Top Years:`);
    Object.entries(byYear)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([year, count]) => {
        console.log(`   • ${year}: ${count}`);
      });

    // Top companies
    const byCompany = {};
    records.forEach(r => {
      const company = r.Company || 'Unknown';
      byCompany[company] = (byCompany[company] || 0) + 1;
    });
    console.log(`\n🏢 Top Companies:`);
    Object.entries(byCompany)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .forEach(([company, count]) => {
        console.log(`   • ${company}: ${count} records`);
      });

    // Total emissions
    const totalEmissions = records.reduce((sum, r) => {
      const value = parseFloat(r.Value || 0);
      return sum + (isNaN(value) ? 0 : value);
    }, 0);
    console.log(`\n💰 Total Emissions Tracked: ${totalEmissions.toLocaleString()} tonnes CO2e`);
    console.log(`   Average per record: ${Math.round(totalEmissions / records.length).toLocaleString()} tonnes`);

    // Verified records
    const verified = records.filter(r => r.Verified === 'Yes').length;
    const verifiedPct = ((verified / records.length) * 100).toFixed(1);
    console.log(`\n✓ Verified Records: ${verified} (${verifiedPct}%)`);

    console.log('\n' + '='.repeat(70));
  }

  /**
   * Main merge function
   */
  async merge() {
    console.log('\n🔗 MASTER DATASET MERGER\n');
    console.log('='.repeat(70));
    console.log('Merging all data sources into single professional CSV');
    console.log('='.repeat(70) + '\n');

    // Load all sources
    console.log('📂 Loading data sources...');
    const ultrathinkData = await this.loadCSV(this.sources.ultrathink);
    const cdpData = await this.loadCSV(this.sources.cdpApi);

    // Normalize structures
    console.log('\n🔧 Normalizing record structures...');
    const normalized = [
      ...this.normalizeRecords(ultrathinkData, 'ULTRATHINK PDF Scraper'),
      ...this.normalizeRecords(cdpData, 'CDP API')
    ];
    console.log(`  ✅ Normalized ${normalized.length} total records`);

    // Standardize units
    const standardized = this.standardizeUnits(normalized);

    // Score quality
    this.scoreDataQuality(standardized);

    // Deduplicate
    const deduplicated = this.deduplicateRecords(standardized);

    // Sort by quality then year
    deduplicated.sort((a, b) => {
      const qualityOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };
      const qDiff = (qualityOrder[a['Data Quality']] || 3) - (qualityOrder[b['Data Quality']] || 3);
      if (qDiff !== 0) return qDiff;
      return b.Year - a.Year; // Newer years first
    });

    // Generate analytics
    this.generateAnalytics(deduplicated);

    // Save to CSV
    console.log(`\n💾 Saving master dataset to ${this.outputFile}...`);
    const csv = stringify(deduplicated, {
      header: true,
      columns: [
        'Company',
        'Year',
        'Scope',
        'Category',
        'Value',
        'Unit',
        'Data Quality',
        'Quality Score',
        'Source',
        'Verified',
        'Confidence',
        'Method',
        'Source File',
        'Raw Text'
      ]
    });
    await fs.writeFile(this.outputFile, csv);

    console.log('\n' + '='.repeat(70));
    console.log('✅ SUCCESS! Master dataset created');
    console.log('='.repeat(70));
    console.log(`\n📄 Output: ${this.outputFile}`);
    console.log(`📊 Total records: ${deduplicated.length}`);
    console.log(`⭐ High quality: ${deduplicated.filter(r => r['Data Quality'] === 'High').length}`);
    console.log(`⭐ Medium quality: ${deduplicated.filter(r => r['Data Quality'] === 'Medium').length}`);
    console.log(`⭐ Low quality: ${deduplicated.filter(r => r['Data Quality'] === 'Low').length}`);
    console.log('\n💡 TIP: Filter by "Data Quality" = "High" for most reliable data');
    console.log('💡 TIP: "Quality Score" ranges from 0-100 for precise filtering\n');

    return deduplicated;
  }
}

/**
 * Main execution
 */
async function main() {
  const merger = new MasterDatasetMerger();
  await merger.merge();
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  });
}

export default MasterDatasetMerger;
