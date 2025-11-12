/**
 * 🔍 ADDITIONAL PDF DATA VERIFICATION
 *
 * Verifies more sample records from the CSV
 */

import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function verifyMoreData() {
  console.log('🔍 ADDITIONAL PDF VERIFICATION');
  console.log('═'.repeat(50));

  const testCases = [
    {
      company: 'Apple Inc',
      file: 'Apple_Environmental_Progress_Report_2025.pdf',
      expectedValues: ['10'],
      scope: 'Scope 3',
      year: '2015'
    },
    {
      company: 'Coca-Cola Europacific Partners',
      file: '2024-CCEP-Annual-Report_2025.03.21_Interactive.pdf',
      expectedValues: ['20', '21.118'],
      scope: 'Scope 1',
      year: '2019'
    },
    {
      company: 'Chipotle Mexican Grill',
      file: '2023-sustainability-report.pdf',
      expectedValues: ['134'],
      scope: 'Scope 1',
      year: '2010'
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📄 VERIFYING: ${testCase.company}`);
    console.log(`   File: ${testCase.file}`);
    console.log(`   Expected: ${testCase.expectedValues.join(', ')} (${testCase.scope}, ${testCase.year})`);

    try {
      const pdfPath = path.join(__dirname, 'downloads', testCase.file);
      const dataBuffer = await fs.readFile(pdfPath);
      const data = await pdfParse(dataBuffer);
      const text = data.text;

      console.log(`   ✅ PDF loaded: ${data.numpages} pages`);

      let foundCount = 0;
      for (const value of testCase.expectedValues) {
        const escapedValue = value.replace('.', '\\.');
        const regex = new RegExp(escapedValue, 'g');
        const matches = text.match(regex);

        if (matches) {
          foundCount++;
          console.log(`   ✅ Found: ${value} (${matches.length} times)`);
        } else {
          console.log(`   ❌ Missing: ${value}`);
        }
      }

      console.log(`   📊 Accuracy: ${foundCount}/${testCase.expectedValues.length} values found`);

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log('✅ ADDITIONAL VERIFICATION COMPLETE');
}

verifyMoreData().catch(console.error);
