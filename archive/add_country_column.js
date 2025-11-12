/**
 * 🌍 ADD COUNTRY COLUMN TO EMISSIONS DATA
 *
 * Adds country information to the emissions dataset for better analysis
 * Maps companies to their headquarters countries
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Input and output files
const INPUT_FILE = path.join(__dirname, 'output', 'emissions_data_FINAL.csv');
const OUTPUT_FILE = path.join(__dirname, 'output', 'emissions_data_with_countries.csv');

// Comprehensive company to country mapping
const COMPANY_COUNTRY_MAP = {
  // Dutch companies
  'ABN AMRO Bank NV': 'Netherlands',
  'Ahold Delhaize': 'Netherlands',
  'Royal Avebe UA': 'Netherlands',
  'FrieslandCampina': 'Netherlands',
  'ING Group': 'Netherlands',
  'KPN NV': 'Netherlands',
  'NN Group NV': 'Netherlands',
  'Rabobank': 'Netherlands',
  'Royal Burg Groep': 'Netherlands',
  'Sligro Food Group': 'Netherlands',
  'Vion Food Group': 'Netherlands',
  'Woolworths Group': 'Netherlands',
  'Florius': 'Netherlands',
  'Essent NV': 'Netherlands',
  'Directflex': 'Netherlands',

  // Belgian companies
  'Coca-Cola Europacific Partners': 'Belgium',
  'Sofina': 'Belgium',

  // American companies
  'Apple Inc': 'United States',
  'Google LLC (Alphabet Inc)': 'United States',
  'Meta Platforms Inc': 'United States',
  'Netflix Inc': 'United States',
  'Tesla Inc': 'United States',
  'Chipotle Mexican Grill': 'United States',
  'Starbucks Corporation': 'United States',
  'JPMorgan Chase & Co': 'United States',
  'Lyft Inc': 'United States',
  'Microsoft Corporation': 'United States',
  'Nike Inc': 'United States',
  'Walmart Inc': 'United States',
  'Consumer Finance': 'United States',

  // British companies
  'Vodafone Group PLC': 'United Kingdom',
  'Shell PLC': 'United Kingdom',
  'Unilever PLC': 'United Kingdom',

  // German companies
  'Deutsche Bank': 'Germany',
  'Siemens': 'Germany',

  // French companies
  'Crédit Agricole Consumer Finance': 'France',
  'Ikea': 'France', // IKEA is Swedish but headquartered in Netherlands, but often associated with Sweden

  // Other European
  'Heineken NV': 'Netherlands',
  'Contact Energy': 'New Zealand',
  'FMC Corporation': 'United States',

  // Asian companies
  'Shein': 'China',

  // Generic mappings for unclear names
  '0 Burg MVO CSR verslag EN  v6': 'Netherlands', // Royal Burg Groep
  'annualreport Annual Report  4': 'Netherlands', // Likely Dutch company
  'h5  Sustainable Impact Report 0': 'Netherlands', // Likely Dutch company
  'heineken n v annual report  final 20feb': 'Netherlands',
  'ing Annual Report  1': 'Netherlands',
  'nn group Annual Report  4': 'Netherlands',
  'vanlanschotkempen Annual Report  7': 'Netherlands',
  'lseg sustainability report': 'United Kingdom', // London Stock Exchange Group
  'PhilipsFullAnnualReport English': 'Netherlands',
  'ReNew Annual Integrated Report FY  24': 'India',
  'STG SR24 English. compressed': 'Netherlands', // Likely Dutch
  'Sustainability Report': 'Unknown',
  'tarkett urd  en published on 03 31 18h52': 'France',
  'trivium packaging sustainability report': 'United States',
  'Jaarverslag': 'Netherlands', // Dutch term for annual report
  'VodafoneZiggo Integrated Annual Report': 'Netherlands',
  'VodafoneZiggo Jaarverslag': 'Netherlands',
  'Impactrapport': 'Netherlands', // Dutch for impact report
  'Impact Report': 'Unknown',
  'KPN integrated annual report   02 21 27 spyv': 'Netherlands',
  'EN Royal Avebe integrated annual report': 'Netherlands',
  'NL Royal Avebe geintegreerd jaarverslag': 'Netherlands',
  'DE Royal-Avebe-integrierter-Geschaftsbericht': 'Germany',
  'DFX SUSTAIN REPORT EN': 'Netherlands',
  'DFX SUSTAIN REPORT NL': 'Netherlands',
  'DFX SUSTAIN REPORT DE': 'Germany',
  'DFX SUSTAIN REPORT FR': 'France',
  'CB-Annual_Report_2024_-_EN': 'France',
  'HEMA_duurzaamheidsverslag_2020': 'Netherlands',
  'HEMA_sustainability_report_2020': 'Netherlands',
  'IOC-Sustainability-Report-2021': 'India',
  'signify-annual-report-2018': 'Netherlands',
  'sustainabilityreport2022_en': 'Unknown',
  'Sustainability_in_motion_-_Nexio_Projects_Impact_Report_2024': 'Netherlands',
  'esg-report-2024-en-v2': 'Unknown',
  'impact-report-2023-final': 'Unknown',
  'ah-duurzaamheidsverslag-2024-eng': 'Netherlands',
  'ah-duurzaamheidsverslag-2024': 'Netherlands'
};

/**
 * Get country for a company name
 */
function getCountry(companyName) {
  if (!companyName) return 'Unknown';

  // Try exact match first
  if (COMPANY_COUNTRY_MAP[companyName]) {
    return COMPANY_COUNTRY_MAP[companyName];
  }

  // Try partial matches
  const lowerName = companyName.toLowerCase();
  for (const [key, country] of Object.entries(COMPANY_COUNTRY_MAP)) {
    if (lowerName.includes(key.toLowerCase())) {
      return country;
    }
  }

  // Try keyword-based matching
  if (lowerName.includes('netherlands') || lowerName.includes('dutch') || lowerName.includes('nederland')) {
    return 'Netherlands';
  }
  if (lowerName.includes('united states') || lowerName.includes('america') || lowerName.includes('us')) {
    return 'United States';
  }
  if (lowerName.includes('united kingdom') || lowerName.includes('uk') || lowerName.includes('british')) {
    return 'United Kingdom';
  }
  if (lowerName.includes('germany') || lowerName.includes('deutsch') || lowerName.includes('german')) {
    return 'Germany';
  }
  if (lowerName.includes('france') || lowerName.includes('french')) {
    return 'France';
  }
  if (lowerName.includes('china') || lowerName.includes('chinese')) {
    return 'China';
  }
  if (lowerName.includes('india') || lowerName.includes('indian')) {
    return 'India';
  }
  if (lowerName.includes('belgium') || lowerName.includes('belgian')) {
    return 'Belgium';
  }

  return 'Unknown';
}

/**
 * Main processing function
 */
async function addCountryColumn() {
  console.log('🌍 ADDING COUNTRY COLUMN TO EMISSIONS DATA');
  console.log('─'.repeat(60));

  try {
    // Read the CSV file
    const content = await fs.readFile(INPUT_FILE, 'utf-8');
    const lines = content.split('\n');
    const headers = lines[0];

    console.log(`📥 Reading ${lines.length - 1} records from ${INPUT_FILE}`);

    // Parse and add country column
    const updatedLines = [headers + ',country'];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV line (simple parser)
      const fields = parseCSVLine(line);
      const companyName = fields[0]; // company_name is first column
      const country = getCountry(companyName);

      // Add country to the end
      fields.push(country);
      updatedLines.push(fields.map(field => `"${field}"`).join(','));
    }

    // Write updated CSV
    const outputContent = '\uFEFF' + updatedLines.join('\n'); // UTF-8 BOM
    await fs.writeFile(OUTPUT_FILE, outputContent, 'utf-8');

    console.log(`✅ Added country column to ${updatedLines.length - 1} records`);
    console.log(`💾 Saved to: ${OUTPUT_FILE}`);

    // Show sample of results
    console.log('\n📊 SAMPLE RESULTS:');
    console.log('─'.repeat(40));
    const sampleLines = updatedLines.slice(1, 6);
    sampleLines.forEach(line => {
      const fields = parseCSVLine(line);
      console.log(`${fields[0]} → ${fields[7]}`); // company_name → country
    });

    // Show country distribution
    console.log('\n🌍 COUNTRY DISTRIBUTION:');
    console.log('─'.repeat(40));
    const countries = {};
    updatedLines.slice(1).forEach(line => {
      const fields = parseCSVLine(line);
      const country = fields[7];
      countries[country] = (countries[country] || 0) + 1;
    });

    Object.entries(countries)
      .sort((a, b) => b[1] - a[1])
      .forEach(([country, count]) => {
        console.log(`${country}: ${count} records`);
      });

  } catch (error) {
    console.error('❌ Error adding country column:', error.message);
    throw error;
  }
}

/**
 * Simple CSV line parser
 */
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current.replace(/^"|"$/g, '')); // Remove surrounding quotes
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.replace(/^"|"$/g, ''));

  return fields;
}

// Run the script
addCountryColumn().catch(console.error);
