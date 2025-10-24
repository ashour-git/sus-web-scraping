import fs from 'fs/promises';
import path from 'path';
import { advancedConfig } from './advancedConfig.js';

/**
 * Final Verification Script
 * Validates scraping completeness across all 10 target websites
 */
async function finalVerification() {
  console.log('🔍 FINAL VERIFICATION REPORT\n');
  console.log('='.repeat(80));
  console.log('Analyzing scraping completeness across all 10 target websites');
  console.log('='.repeat(80) + '\n');

  try {
    // Check if downloads directory exists
    try {
      await fs.access(advancedConfig.pdfOutputDir);
    } catch {
      console.log('❌ Downloads directory does not exist.');
      return;
    }

    // Read all PDF files
    const files = await fs.readdir(advancedConfig.pdfOutputDir);
    const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));

    if (pdfFiles.length === 0) {
      console.log('❌ No PDF files found in downloads directory.\n');
      return;
    }

    console.log(`📁 Total PDF files: ${pdfFiles.length}\n`);

    // Analyze each file
    const fileStats = [];
    for (const file of pdfFiles) {
      const filePath = path.join(advancedConfig.pdfOutputDir, file);
      const stats = await fs.stat(filePath);

      // Read first 4 bytes to check if real PDF
      const handle = await fs.open(filePath, 'r');
      const buffer = Buffer.allocUnsafe(4);
      await handle.read(buffer, 0, 4, 0);
      await handle.close();

      const isPDF = buffer.toString('ascii').startsWith('%PDF');

      fileStats.push({
        name: file,
        size: stats.size,
        sizeKB: (stats.size / 1024).toFixed(2),
        sizeMB: (stats.size / 1024 / 1024).toFixed(2),
        isPDF,
        suspicious: !isPDF || stats.size < 10240 // <10KB or not PDF
      });
    }

    // Categorize files
    const validPDFs = fileStats.filter(f => f.isPDF && !f.suspicious);
    const suspiciousPDFs = fileStats.filter(f => f.suspicious);

    // Overall statistics
    console.log('📊 OVERALL STATISTICS:');
    console.log('-'.repeat(80));
    console.log(`  Total files: ${pdfFiles.length}`);
    console.log(`  ✅ Valid PDFs: ${validPDFs.length} (${(validPDFs.length / pdfFiles.length * 100).toFixed(1)}%)`);
    console.log(`  ❌ Suspicious/Invalid: ${suspiciousPDFs.length} (${(suspiciousPDFs.length / pdfFiles.length * 100).toFixed(1)}%)`);

    const totalSizeMB = fileStats.reduce((sum, f) => sum + parseFloat(f.sizeMB), 0);
    console.log(`  💾 Total size: ${totalSizeMB.toFixed(2)} MB`);
    console.log('-'.repeat(80) + '\n');

    // Analyze by source website
    console.log('🌐 BREAKDOWN BY WEBSITE:\n');

    const websitePatterns = [
      { name: 'ADX Abu Dhabi', patterns: ['adx', 'abu-dhabi', 'abudhabi'], url: advancedConfig.failedWebsites[0] },
      { name: 'Tadawul', patterns: ['tadawul', 'saudi'], url: 'https://www.saudiexchange.sa' },
      { name: 'EGX Egypt', patterns: ['egx', 'egypt', 'egyptian'], url: advancedConfig.failedWebsites[1] },
      { name: 'NASDAQ US', patterns: ['nasdaq-us', 'nasdaq.com'], url: advancedConfig.failedWebsites[2] },
      { name: 'NASDAQ Dubai', patterns: ['nasdaq-dubai', 'nasdaqdubai', 'CB-Annual'], url: 'https://www.nasdaqdubai.com' },
      { name: 'LSEG', patterns: ['lseg', 'london-stock'], url: 'https://www.lseg.com' },
      { name: 'Sustainability Reports', patterns: ['sustainability-reports.com'], url: 'https://www.sustainability-reports.com' },
      { name: 'PwC', patterns: ['pwc', 'esg-report'], url: 'https://www.pwc.com' },
      { name: 'Contact Egypt', patterns: ['contact-egypt', 'contactegypt'], url: advancedConfig.failedWebsites[3] },
      { name: 'EGCX', patterns: ['egcx', 'egypt-gold'], url: 'https://www.egcx.com.eg' }
    ];

    const websiteResults = websitePatterns.map(website => {
      const matchingFiles = fileStats.filter(file => {
        const lowerName = file.name.toLowerCase();
        return website.patterns.some(pattern => lowerName.includes(pattern));
      });

      const validCount = matchingFiles.filter(f => !f.suspicious).length;
      const suspiciousCount = matchingFiles.filter(f => f.suspicious).length;

      return {
        name: website.name,
        url: website.url,
        total: matchingFiles.length,
        valid: validCount,
        suspicious: suspiciousCount,
        files: matchingFiles,
        status: validCount > 0 ? '✅' : (matchingFiles.length > 0 ? '⚠️' : '❌')
      };
    });

    websiteResults.forEach((result, i) => {
      console.log(`${i + 1}. ${result.status} ${result.name}`);
      console.log(`   Total files: ${result.total} | Valid: ${result.valid} | Suspicious: ${result.suspicious}`);

      if (result.valid > 0) {
        result.files.filter(f => !f.suspicious).forEach(file => {
          console.log(`     ✓ ${file.name} (${file.sizeMB} MB)`);
        });
      }

      if (result.suspicious > 0) {
        result.files.filter(f => f.suspicious).forEach(file => {
          console.log(`     ✗ ${file.name} (${file.sizeKB} KB - ${file.isPDF ? 'too small' : 'not PDF'})`);
        });
      }

      if (result.total === 0) {
        console.log(`     ❌ NO FILES DOWNLOADED`);
      }
      console.log('');
    });

    // Success metrics
    const fullySuccessful = websiteResults.filter(r => r.valid > 0).length;
    const partialSuccess = websiteResults.filter(r => r.valid === 0 && r.total > 0).length;
    const failed = websiteResults.filter(r => r.total === 0).length;

    console.log('='.repeat(80));
    console.log('FINAL VERDICT:');
    console.log('='.repeat(80));
    console.log(`  ✅ Fully successful: ${fullySuccessful}/10 websites (${(fullySuccessful / 10 * 100).toFixed(0)}%)`);
    console.log(`  ⚠️  Partially successful: ${partialSuccess}/10 websites`);
    console.log(`  ❌ Failed: ${failed}/10 websites`);
    console.log('='.repeat(80));

    if (suspiciousPDFs.length > 0) {
      console.log('\n⚠️  WARNING: Suspicious files detected!');
      console.log('   Run cleanup script: node src/cleanup.js\n');
    }

    if (failed > 0) {
      console.log('\n⚠️  INCOMPLETE SCRAPING:');
      console.log('   Some websites returned no files.');
      console.log('   Possible reasons:');
      console.log('     • Authentication required');
      console.log('     • CAPTCHA blocking');
      console.log('     • IP blocking / Geo-restrictions');
      console.log('     • Content behind paywall\n');
    }

    if (fullySuccessful === 10 && suspiciousPDFs.length === 0) {
      console.log('\n🎉 SUCCESS! All 10 websites scraped successfully with valid PDFs!\n');
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
  }
}

// Run verification
finalVerification().catch(console.error);
