import { AdvancedBrowserManager } from './advancedBrowser.js';
import { advancedConfig } from './advancedConfig.js';
import { CSVWriter } from './csvWriter.js';
import { PDFParser } from './pdfParser.js';
import { PDFValidator } from './pdfValidator.js';
import { UltraAdvancedPDFDownloader } from './ultraAdvancedDownloader.js';

/**
 * Ultra-Advanced Emissions Scraper
 * Targets the 4 failed websites with advanced techniques
 */
export class UltraAdvancedScraper {
  constructor() {
    this.browserManager = new AdvancedBrowserManager();
    this.pdfDownloader = new UltraAdvancedPDFDownloader(this.browserManager);
    this.pdfValidator = new PDFValidator(advancedConfig.pdfValidation);
    this.pdfParser = new PDFParser();
    this.csvWriter = new CSVWriter();
  }

  async run() {
    console.log('🚀 ULTRA-ADVANCED EMISSIONS DATA SCRAPER v2.0\n');
    console.log('🎯 Targeting 4 failed high-security websites\n');
    console.log('='.repeat(80));
    console.log('Target URLs:');
    advancedConfig.failedWebsites.forEach((url, i) => {
      console.log(`  ${i + 1}. ${url}`);
    });
    console.log('='.repeat(80) + '\n');

    try {
      // Step 1: Clean up fake PDFs from previous run
      console.log('🧹 STEP 1: Cleaning up fake PDFs from previous run...\n');
      const cleanupResults = await this.pdfValidator.cleanupFakePDFs(
        advancedConfig.pdfOutputDir,
        false // Set to true for dry run
      );
      console.log(`\n✅ Cleanup complete: ${cleanupResults.invalid.length} fake PDFs removed\n`);

      // Step 2: Initialize advanced browser
      console.log('🌐 STEP 2: Initializing ultra-advanced browser...\n');
      await this.browserManager.initialize();
      console.log('');

      // Step 3: Download PDFs with advanced techniques
      console.log('📥 STEP 3: Downloading PDFs from failed websites...\n');
      const downloadedFiles = await this.pdfDownloader.downloadFromUrls(
        advancedConfig.failedWebsites
      );

      if (downloadedFiles.length === 0) {
        console.log('\n⚠️  No new PDFs were downloaded.');
        console.log('This could mean:');
        console.log('  • Websites require manual authentication');
        console.log('  • CAPTCHA couldn\'t be bypassed automatically');
        console.log('  • IP is blocked (try using proxies)');
        console.log('  • Content is behind paywalls/login');
        return;
      }

      // Step 4: Parse PDFs
      console.log('\n📊 STEP 4: Parsing PDFs and extracting emissions data...\n');
      const records = await this.pdfParser.parseAllPDFs(downloadedFiles);

      if (records.length === 0) {
        console.log('\n⚠️  No emissions data found in new PDFs.');
        return;
      }

      // Step 5: Append to existing CSV
      console.log('\n💾 STEP 5: Appending data to CSV...\n');
      await this.csvWriter.appendRecords(advancedConfig.csvOutputPath, records);

      // Step 6: Final report
      console.log('\n✅ ULTRA-ADVANCED SCRAPING COMPLETED!\n');
      console.log('='.repeat(80));
      console.log('FINAL SUMMARY:');
      console.log('='.repeat(80));
      console.log(`  • Fake PDFs removed: ${cleanupResults.invalid.length}`);
      console.log(`  • New PDFs downloaded: ${downloadedFiles.length}`);
      console.log(`  • Emission records extracted: ${records.length}`);
      console.log(`  • Output file: ${advancedConfig.csvOutputPath}`);
      console.log('='.repeat(80) + '\n');

    } catch (error) {
      console.error('\n❌ CRITICAL ERROR:', error.message);
      console.error(error.stack);
    } finally {
      await this.browserManager.close();
    }
  }
}

// Run if called directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const scraper = new UltraAdvancedScraper();
  scraper.run().catch(console.error);
}
