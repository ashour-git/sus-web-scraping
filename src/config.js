import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

export const config = {
  targetUrls: process.env.TARGET_URLS?.split(',').map(url => url.trim()) || [],
  downloadTimeout: parseInt(process.env.DOWNLOAD_TIMEOUT) || 90000,
  pdfOutputDir: process.env.PDF_OUTPUT_DIR || path.join(__dirname, '../downloads'),
  csvOutputPath: process.env.CSV_OUTPUT_PATH || path.join(__dirname, '../output/emissions_data.csv'),
  headless: process.env.HEADLESS === 'true',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};
