// Ultra-Advanced Configuration for High-Security Website Scraping
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

export const advancedConfig = {
  // Target URLs - Only failed websites
  failedWebsites: [
    'https://www.adx.ae/issuers/esg/companies-sustainability-reports',
    'https://www.egx.com.eg/en/Sustainability-Reports.aspx',
    'https://www.nasdaq.com/nasdaq-2024-sustainability-report',
    'https://www.egcx.com.eg/single_category/4'
  ],

  // Timeouts
  navigationTimeout: 120000,
  downloadTimeout: 90000,
  captchaTimeout: 180000,

  // Directories
  pdfOutputDir: process.env.PDF_OUTPUT_DIR || path.join(__dirname, '../downloads'),
  csvOutputPath: process.env.CSV_OUTPUT_PATH || path.join(__dirname, '../output/emissions_data.csv'),

  // Browser Configuration
  headless: process.env.HEADLESS === 'true',
  slowMo: 100, // Slow down actions to appear more human

  // CAPTCHA Solving
  captcha: {
    enabled: true,
    provider: '2captcha', // or 'anticaptcha'
    apiKey: process.env.CAPTCHA_API_KEY || 'YOUR_2CAPTCHA_API_KEY',
    retries: 3
  },

  // Proxy Configuration
  proxy: {
    enabled: process.env.USE_PROXY === 'true',
    rotating: true,
    list: [
      // Add your proxy list here
      // Format: 'http://username:password@proxy-host:port'
    ],
    fallbackToDirect: true
  },

  // Session Management
  session: {
    enabled: true,
    cookiesFile: path.join(__dirname, '../.cache/cookies.json'),
    storageFile: path.join(__dirname, '../.cache/storage.json'),
    persistSession: true
  },

  // PDF Validation
  pdfValidation: {
    enabled: true,
    minSize: 10000, // 10KB minimum
    maxSize: 500000000, // 500MB maximum
    checkMagicBytes: true,
    requireValidStructure: true
  },

  // Rate Limiting & Human Behavior
  rateLimiting: {
    delayBetweenPages: [3000, 7000], // Random delay range in ms
    delayBetweenDownloads: [2000, 5000],
    delayBetweenWebsites: [5000, 10000],
    maxConcurrentDownloads: 2
  },

  // User Agent Rotation
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
  ],

  // Viewport Configurations
  viewports: [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 }
  ],

  // JavaScript Execution Delays
  jsExecutionDelays: {
    afterNavigation: 8000,
    afterScroll: 3000,
    afterClick: 2000,
    afterModal: 1500
  },

  // Advanced Stealth Features
  stealth: {
    maskWebdriver: true,
    maskPlugins: true,
    maskLanguages: false,
    maskTimezone: false,
    mockPermissions: true,
    mockDeviceMemory: true,
    mockHardwareConcurrency: true
  },

  // Retry Configuration
  retries: {
    maxAttempts: 5,
    backoffMultiplier: 2,
    initialDelay: 5000
  }
};

export const config = {
  targetUrls: process.env.TARGET_URLS?.split(',').map(url => url.trim()) || [],
  downloadTimeout: parseInt(process.env.DOWNLOAD_TIMEOUT) || 60000,
  pdfOutputDir: advancedConfig.pdfOutputDir,
  csvOutputPath: advancedConfig.csvOutputPath,
  headless: advancedConfig.headless,
  userAgent: advancedConfig.userAgents[0]
};
