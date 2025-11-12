import { BrowserManager } from './browser.js';
import { config } from './config.js';
import { PDFDownloader } from './pdfDownloader.js';

export class EmissionsScraper {
  constructor() {
    this.browserManager = new BrowserManager();
    this.pdfDownloader = new PDFDownloader(this.browserManager);
  }

  async run() {
    console.log('🚀 Starting Emissions Data Scraper\n');
    console.log(`Target URLs: ${config.targetUrls.length} websites\n`);

    try {
      await this.browserManager.initialize();

      console.log('📥 Step 1: Downloading PDFs...');
      const downloadedFiles = await this.pdfDownloader.downloadFromUrls(config.targetUrls);

      if (downloadedFiles.length === 0) {
        console.log('\n⚠️  No PDFs were downloaded. Please check your target URLs.');
        await this.browserManager.close();
        return downloadedFiles; // Return empty array instead of undefined
      }

      // Note: PDF parsing is done in pipeline.js step 2, not here
      // This scraper only downloads PDFs
      console.log('\n✅ PDF download phase completed!');
      console.log(`\nSummary:`);
      console.log(`  - PDFs downloaded: ${downloadedFiles.length}`);
      console.log(`  - Next: PDFs will be processed in pipeline step 2`);

      await this.browserManager.close();
      return downloadedFiles; // Always return the files array

    } catch (error) {
      console.error('\n❌ Error during scraping:', error.message);
      if (this.browserManager) {
        await this.browserManager.close();
      }
      return []; // Return empty array on error
    }
  }
}
