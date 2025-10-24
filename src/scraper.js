import { BrowserManager } from './browser.js';
import { config } from './config.js';
import { CSVWriter } from './csvWriter.js';
import { PDFDownloader } from './pdfDownloader.js';
import { PDFParser } from './pdfParser.js';

export class EmissionsScraper {
  constructor() {
    this.browserManager = new BrowserManager();
    this.pdfDownloader = new PDFDownloader(this.browserManager);
    this.pdfParser = new PDFParser();
    this.csvWriter = new CSVWriter();
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
        return;
      }

      console.log('\n📊 Step 2: Parsing PDFs and extracting emissions data...');
      const records = await this.pdfParser.parseAllPDFs(downloadedFiles);

      if (records.length === 0) {
        console.log('\n⚠️  No emissions data found in PDFs.');
        return;
      }

      console.log('\n💾 Step 3: Writing data to CSV...');
      await this.csvWriter.writeRecords(records);

      console.log('\n✅ Scraping completed successfully!');
      console.log(`\nSummary:`);
      console.log(`  - PDFs downloaded: ${downloadedFiles.length}`);
      console.log(`  - Emission records extracted: ${records.length}`);
      console.log(`  - Output file: ${config.csvOutputPath}`);

    } catch (error) {
      console.error('\n❌ Error during scraping:', error.message);
      throw error;
    } finally {
      await this.browserManager.close();
    }
  }
}
