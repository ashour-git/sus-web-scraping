import fs from 'fs/promises';
import path from 'path';

/**
 * Comprehensive Status Report Generator
 * Shows detailed status of all 10 target websites
 */

async function generateStatusReport() {
  console.log('📊 COMPREHENSIVE WEBSITE STATUS REPORT\n');
  console.log('='.repeat(80));
  console.log('Generated: ' + new Date().toLocaleString());
  console.log('='.repeat(80) + '\n');

  const downloadsDir = './downloads';
  const targetWebsites = [
    {
      name: 'ADX - Abu Dhabi Securities Exchange',
      url: 'https://www.adx.ae',
      patterns: ['adx', 'abu-dhabi', 'abudhabi'],
      priority: 'HIGH - Enhanced Targeting',
      issues: 'Returns HTML error pages instead of PDFs, CAPTCHA protection'
    },
    {
      name: 'Tadawul - Saudi Stock Exchange',
      url: 'https://www.saudiexchange.sa',
      patterns: ['tadawul', 'saudi', 'STG_SR24'],
      priority: 'MEDIUM',
      issues: 'HTML error pages, requires authentication'
    },
    {
      name: 'EGX - Egyptian Exchange',
      url: 'https://www.egx.com.eg',
      patterns: ['egx', 'egypt', 'egyptian'],
      priority: 'HIGH - Enhanced Targeting',
      issues: 'Access blocked, geo-restrictions possible'
    },
    {
      name: 'NASDAQ US - Sustainability Reports',
      url: 'https://www.nasdaq.com',
      patterns: ['nasdaq-us', 'nasdaq.com'],
      priority: 'HIGH - Enhanced Targeting',
      issues: 'Content behind login/paywall'
    },
    {
      name: 'NASDAQ Dubai',
      url: 'https://www.nasdaqdubai.com',
      patterns: ['nasdaq-dubai', 'nasdaqdubai', 'CB-Annual'],
      priority: 'LOW - Previously Successful',
      issues: 'None - Successfully scraped'
    },
    {
      name: 'LSEG - London Stock Exchange Group',
      url: 'https://www.lseg.com',
      patterns: ['lseg', 'london-stock'],
      priority: 'LOW - Previously Successful',
      issues: 'None - Successfully scraped'
    },
    {
      name: 'Sustainability Reports Aggregator',
      url: 'https://www.sustainability-reports.com',
      patterns: ['sustainability-reports.com', 'Annual_sustainability'],
      priority: 'MEDIUM',
      issues: 'Mixed results - some valid PDFs obtained'
    },
    {
      name: 'PwC - ESG Reports',
      url: 'https://www.pwc.com',
      patterns: ['pwc', 'esg-report'],
      priority: 'LOW - Previously Successful',
      issues: 'None - Successfully scraped'
    },
    {
      name: 'Contact Egypt',
      url: 'https://www.contactegypt.com.eg',
      patterns: ['contact-egypt', 'contactegypt', 'contact-sustainability'],
      priority: 'HIGH - Enhanced Targeting',
      issues: 'Access issues, may require authentication'
    },
    {
      name: 'EGCX - Egyptian Commodities Exchange',
      url: 'https://www.egcx.com.eg',
      patterns: ['egcx', 'egypt-gold'],
      priority: 'MEDIUM',
      issues: 'Limited ESG reporting availability'
    }
  ];

  try {
    // Check if downloads directory exists
    let files = [];
    try {
      files = await fs.readdir(downloadsDir);
    } catch {
      console.log('⚠️  Downloads directory does not exist yet.\n');
    }

    const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));

    console.log(`📁 Total PDFs in downloads: ${pdfFiles.length}\n`);

    // Analyze each file
    const fileStats = [];
    for (const file of pdfFiles) {
      const filePath = path.join(downloadsDir, file);
      const stats = await fs.stat(filePath);

      // Check if real PDF
      const handle = await fs.open(filePath, 'r');
      const buffer = Buffer.allocUnsafe(4);
      await handle.read(buffer, 0, 4, 0);
      await handle.close();

      const isPDF = buffer.toString('ascii').startsWith('%PDF');

      fileStats.push({
        name: file,
        size: stats.size,
        sizeMB: (stats.size / 1024 / 1024).toFixed(2),
        isPDF,
        valid: isPDF && stats.size >= 10240
      });
    }

    const validPDFs = fileStats.filter(f => f.valid);
    const invalidPDFs = fileStats.filter(f => !f.valid);

    // Website-by-website breakdown
    console.log('🌐 WEBSITE STATUS BREAKDOWN:\n');
    console.log('='.repeat(80));

    const results = [];

    for (const website of targetWebsites) {
      const matchingFiles = fileStats.filter(file => {
        const lowerName = file.name.toLowerCase();
        return website.patterns.some(pattern => lowerName.includes(pattern.toLowerCase()));
      });

      const validFiles = matchingFiles.filter(f => f.valid);
      const invalidFiles = matchingFiles.filter(f => !f.valid);

      const status = validFiles.length > 0 ? '✅ SUCCESS' :
                     matchingFiles.length > 0 ? '⚠️  PARTIAL' :
                     '❌ FAILED';

      const result = {
        website,
        status,
        totalFiles: matchingFiles.length,
        validFiles: validFiles.length,
        invalidFiles: invalidFiles.length,
        files: matchingFiles
      };

      results.push(result);

      console.log(`\n${status} - ${website.name}`);
      console.log(`URL: ${website.url}`);
      console.log(`Priority: ${website.priority}`);
      console.log(`PDFs: ${result.totalFiles} total (${result.validFiles} valid, ${result.invalidFiles} invalid)`);

      if (validFiles.length > 0) {
        console.log(`Valid PDFs:`);
        validFiles.forEach(file => {
          console.log(`  ✓ ${file.name} (${file.sizeMB} MB)`);
        });
      }

      if (invalidFiles.length > 0) {
        console.log(`Invalid PDFs:`);
        invalidFiles.forEach(file => {
          console.log(`  ✗ ${file.name} (${file.sizeMB} MB - ${file.isPDF ? 'too small' : 'not PDF'})`);
        });
      }

      if (result.totalFiles === 0) {
        console.log(`Status: NO FILES DOWNLOADED`);
      }

      console.log(`Known Issues: ${website.issues}`);
      console.log('-'.repeat(80));
    }

    // Overall statistics
    const successful = results.filter(r => r.validFiles > 0).length;
    const partial = results.filter(r => r.validFiles === 0 && r.totalFiles > 0).length;
    const failed = results.filter(r => r.totalFiles === 0).length;

    console.log('\n' + '='.repeat(80));
    console.log('📊 OVERALL STATISTICS');
    console.log('='.repeat(80));
    console.log(`Total websites monitored: 10`);
    console.log(`✅ Fully successful: ${successful}/10 (${(successful / 10 * 100).toFixed(0)}%)`);
    console.log(`⚠️  Partially successful: ${partial}/10 (${(partial / 10 * 100).toFixed(0)}%)`);
    console.log(`❌ Failed: ${failed}/10 (${(failed / 10 * 100).toFixed(0)}%)`);
    console.log('='.repeat(80));
    console.log(`Total valid PDFs: ${validPDFs.length}`);
    console.log(`Total invalid PDFs: ${invalidPDFs.length}`);
    console.log(`Total size: ${fileStats.reduce((sum, f) => sum + parseFloat(f.sizeMB), 0).toFixed(2)} MB`);
    console.log('='.repeat(80));

    // Success rate analysis
    console.log('\n📈 SUCCESS RATE ANALYSIS:\n');
    console.log('Current completion: ' + '█'.repeat(successful * 2) + '░'.repeat((10 - successful) * 2) + ` ${successful}/10`);
    console.log(`Progress: ${(successful / 10 * 100).toFixed(0)}%`);

    if (failed > 0) {
      console.log(`\n⚠️  ${failed} websites still need attention`);
      console.log('Recommended actions:');
      console.log('  1. Enable proxy rotation for geo-blocked sites');
      console.log('  2. Configure CAPTCHA API keys for protected sites');
      console.log('  3. Manual authentication may be required for some sites');
      console.log('  4. Consider alternative data sources for paywalled content');
    }

    // Top performing websites
    console.log('\n🏆 TOP PERFORMING WEBSITES:\n');
    const topWebsites = results
      .filter(r => r.validFiles > 0)
      .sort((a, b) => b.validFiles - a.validFiles)
      .slice(0, 5);

    topWebsites.forEach((result, i) => {
      const totalSize = result.files
        .filter(f => f.valid)
        .reduce((sum, f) => sum + parseFloat(f.sizeMB), 0);

      console.log(`${i + 1}. ${result.website.name}`);
      console.log(`   Files: ${result.validFiles} | Size: ${totalSize.toFixed(2)} MB`);
    });

    // Save report to file
    const reportContent = generateTextReport(results, successful, partial, failed, validPDFs.length, invalidPDFs.length);
    await fs.writeFile('./output/website_status_report.txt', reportContent);

    console.log('\n📄 Full report saved to: ./output/website_status_report.txt\n');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    throw error;
  }
}

function generateTextReport(results, successful, partial, failed, validCount, invalidCount) {
  let report = '';

  report += '='.repeat(80) + '\n';
  report += 'COMPREHENSIVE WEBSITE STATUS REPORT\n';
  report += 'Generated: ' + new Date().toISOString() + '\n';
  report += '='.repeat(80) + '\n\n';

  report += 'EXECUTIVE SUMMARY:\n';
  report += '-'.repeat(80) + '\n';
  report += `Websites monitored: 10\n`;
  report += `Fully successful: ${successful}/10 (${(successful / 10 * 100).toFixed(0)}%)\n`;
  report += `Partially successful: ${partial}/10\n`;
  report += `Failed: ${failed}/10\n`;
  report += `Total valid PDFs: ${validCount}\n`;
  report += `Total invalid PDFs: ${invalidCount}\n`;
  report += '-'.repeat(80) + '\n\n';

  report += 'DETAILED BREAKDOWN BY WEBSITE:\n';
  report += '-'.repeat(80) + '\n';

  results.forEach((result, i) => {
    report += `\n${i + 1}. ${result.website.name}\n`;
    report += `   URL: ${result.website.url}\n`;
    report += `   Status: ${result.status}\n`;
    report += `   Priority: ${result.priority}\n`;
    report += `   Files: ${result.totalFiles} total (${result.validFiles} valid, ${result.invalidFiles} invalid)\n`;
    report += `   Issues: ${result.website.issues}\n`;

    if (result.validFiles > 0) {
      report += `   Valid PDFs:\n`;
      result.files.filter(f => f.valid).forEach(file => {
        report += `     - ${file.name} (${file.sizeMB} MB)\n`;
      });
    }
  });

  report += '\n' + '-'.repeat(80) + '\n';
  report += 'END OF REPORT\n';
  report += '='.repeat(80) + '\n';

  return report;
}

// Run status report
generateStatusReport().catch(console.error);
