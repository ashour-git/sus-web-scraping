import axios from 'axios';
import fs from 'fs/promises';
import { CSVWriter } from './csvWriter.js';

/**
 * CDP (Carbon Disclosure Project) API Data Collector
 *
 * Collects structured emissions data from CDP's database
 * - Scope 1, 2, 3 emissions
 * - Verified and validated data
 * - 23,000+ companies globally
 *
 * Setup:
 * 1. Register at https://www.cdp.net/
 * 2. Request API access (free for research)
 * 3. Set CDP_API_KEY in .env file
 */
export class CDPApiCollector {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.cdp.net/v1';
    this.targetCompanies = [
      // Stock Exchanges
      'Saudi Stock Exchange (Tadawul)',
      'Abu Dhabi Securities Exchange',
      'NASDAQ Dubai',
      'Egyptian Exchange',
      'London Stock Exchange Group',

      // Financial institutions active in these markets
      'PwC Middle East',
      'Telecom Egypt',

      // Additional companies from our PDFs
      'ABN AMRO',
      'Albert Heijn',
      'Apple Inc',
      'Google LLC',
      'Tesla Inc',
      'Heineken',
      'Philips',
      'ING Group',
      'KPN',
      'NN Group'
    ];
  }

  /**
   * Fetch emissions data for a company
   */
  async getCompanyEmissions(companyName, year = 2024) {
    try {
      console.log(`  Fetching data for: ${companyName}`);

      const response = await axios.get(`${this.baseUrl}/companies/emissions`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        params: {
          company: companyName,
          year: year
        }
      });

      return this.parseEmissionsResponse(response.data, companyName, year);
    } catch (error) {
      if (error.response?.status === 401) {
        console.error('  ❌ Authentication failed - check your CDP API key');
      } else if (error.response?.status === 404) {
        console.log(`  ⚠️  No data found for ${companyName}`);
      } else {
        console.error(`  ❌ Error: ${error.message}`);
      }
      return [];
    }
  }

  /**
   * Parse CDP API response
   */
  parseEmissionsResponse(data, companyName, year) {
    const records = [];

    if (data.scope1) {
      records.push({
        Company: companyName,
        Year: year,
        Scope: 'Scope 1',
        Category: 'Direct Emissions',
        Value: data.scope1.value,
        Unit: data.scope1.unit || 'tonnes CO2e',
        Source: 'CDP API',
        'Data Quality': 'High',
        Verified: data.scope1.verified ? 'Yes' : 'No'
      });
    }

    if (data.scope2) {
      records.push({
        Company: companyName,
        Year: year,
        Scope: 'Scope 2',
        Category: 'Indirect Emissions',
        Value: data.scope2.value,
        Unit: data.scope2.unit || 'tonnes CO2e',
        Source: 'CDP API',
        'Data Quality': 'High',
        Verified: data.scope2.verified ? 'Yes' : 'No'
      });
    }

    if (data.scope3) {
      records.push({
        Company: companyName,
        Year: year,
        Scope: 'Scope 3',
        Category: 'Value Chain Emissions',
        Value: data.scope3.value,
        Unit: data.scope3.unit || 'tonnes CO2e',
        Source: 'CDP API',
        'Data Quality': 'High',
        Verified: data.scope3.verified ? 'Yes' : 'No'
      });
    }

    return records;
  }

  /**
   * Collect data for all target companies
   */
  async collectAllCompanies() {
    console.log('\n🌍 CDP API DATA COLLECTION\n');
    console.log('='​.repeat(70));
    console.log(`Target companies: ${this.targetCompanies.length}`);
    console.log('Years: 2022, 2023, 2024');
    console.log('='​.repeat(70) + '\n');

    const allRecords = [];
    const years = [2022, 2023, 2024];

    for (const company of this.targetCompanies) {
      console.log(`\n📊 Processing: ${company}`);

      for (const year of years) {
        const records = await this.getCompanyEmissions(company, year);
        allRecords.push(...records);

        // Rate limiting - CDP API allows 10 requests/second
        await this.sleep(100);
      }
    }

    return allRecords;
  }

  /**
   * Sleep utility for rate limiting
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Main collection function
   */
  async collect() {
    console.log('\n🚀 Starting CDP API Data Collection...\n');

    // Check for API key
    if (!this.apiKey) {
      console.error('❌ ERROR: CDP_API_KEY not found!');
      console.log('\n📋 Setup Instructions:');
      console.log('1. Register at https://www.cdp.net/');
      console.log('2. Request API access (free for research)');
      console.log('3. Create .env file with: CDP_API_KEY=your_key_here');
      console.log('4. Run: node src/cdpApiCollector.js\n');
      return [];
    }

    // Collect data
    const records = await this.collectAllCompanies();

    // Save to CSV
    if (records.length > 0) {
      const outputFile = 'output/emissions_data_cdp_api.csv';
      console.log(`\n💾 Saving ${records.length} records to ${outputFile}...`);

      const csvWriter = new CSVWriter(outputFile);
      await csvWriter.writeRecords(records);

      // Generate summary
      this.generateSummary(records);
    } else {
      console.log('\n⚠️  No records collected. Check:');
      console.log('  1. API key is valid');
      console.log('  2. Company names match CDP database');
      console.log('  3. API endpoint is accessible\n');
    }

    return records;
  }

  /**
   * Generate collection summary
   */
  generateSummary(records) {
    console.log('\n' + '='.repeat(70));
    console.log('📊 CDP API COLLECTION SUMMARY');
    console.log('='.repeat(70));

    console.log(`\n✅ Total records: ${records.length}`);

    // By company
    const byCompany = {};
    records.forEach(r => {
      byCompany[r.Company] = (byCompany[r.Company] || 0) + 1;
    });
    console.log(`\n🏢 Records by Company:`);
    Object.entries(byCompany)
      .sort((a, b) => b[1] - a[1])
      .forEach(([company, count]) => {
        console.log(`   • ${company}: ${count} records`);
      });

    // By scope
    const byScope = {};
    records.forEach(r => {
      byScope[r.Scope] = (byScope[r.Scope] || 0) + 1;
    });
    console.log(`\n🎯 Records by Scope:`);
    Object.entries(byScope).forEach(([scope, count]) => {
      console.log(`   • ${scope}: ${count} records`);
    });

    // Total emissions
    const totalEmissions = records.reduce((sum, r) => sum + (parseFloat(r.Value) || 0), 0);
    console.log(`\n💰 Total Emissions: ${totalEmissions.toLocaleString()} tonnes CO2e`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ SUCCESS! CDP API data collection complete');
    console.log('='.repeat(70) + '\n');
  }
}

/**
 * Main execution
 */
async function main() {
  // Try to load API key from environment or .env file
  let apiKey = process.env.CDP_API_KEY;

  if (!apiKey) {
    try {
      // Try to read from .env file
      const envContent = await fs.readFile('.env', 'utf-8');
      const match = envContent.match(/CDP_API_KEY=(.+)/);
      if (match) {
        apiKey = match[1].trim();
      }
    } catch {
      // .env file doesn't exist, that's okay
    }
  }

  const collector = new CDPApiCollector(apiKey);
  await collector.collect();
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  });
}

export default CDPApiCollector;
