/**
 * 🔍 PDF DATA VERIFICATION SCRIPT
 *
 * Verifies that CSV data matches actual PDF content
 */

import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Verify specific emissions values in PDFs
 */
async function verifyPDFData() {
  console.log('🔍 PDF DATA VERIFICATION');
  console.log('═'.repeat(50));

  const testCases = [
    {
      company: 'Ahold Delhaize',
      file: 'ah-duurzaamheidsverslag-2024-eng.pdf',
      expectedValues: ['86.3', '87.8', '89.6'],
      scope: 'Scope 1',
      year: '2018'
    },
    {
      company: 'ABN AMRO Bank NV',
      file: 'ABN_AMRO___Integrated_Annual_Report_2024.pdf',
      expectedValues: ['227.6', '271', '117.6'],
      scope: 'Scope 1',
      year: '2021'
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

      console.log(`   ✅ PDF loaded: ${data.numpages} pages, ${text.length} characters`);

      // Check for expected values
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

      // Show context around emissions data
      const lines = text.split('\n');
      const emissionLines = lines.filter(line =>
        /\d+\.?\d*/.test(line) &&
        (line.toLowerCase().includes('scope') ||
         line.toLowerCase().includes('emission') ||
         line.toLowerCase().includes('co2') ||
         line.toLowerCase().includes('mt'))
      );

      if (emissionLines.length > 0) {
        console.log(`   📝 Sample emission lines:`);
        emissionLines.slice(0, 3).forEach((line, i) => {
          console.log(`     ${i+1}: ${line.trim().substring(0, 80)}...`);
        });
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log('🔍 VERIFICATION COMPLETE');
  console.log('\n💡 Note: This verifies data presence, not extraction accuracy.');
  console.log('   Manual review of extraction patterns may be needed for full validation.');
}

// Run verification
verifyPDFData().catch(console.error);
