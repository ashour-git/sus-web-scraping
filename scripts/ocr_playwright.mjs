import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';
import Tesseract from 'tesseract.js';
import { fileURLToPath } from 'url';
import { PDFParser } from '../src/pdfParser.js';

// compute __dirname in an ESM-safe, Windows-friendly way
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOWNLOADS = path.join(ROOT, 'downloads');
const OUTPUT_DIR = path.join(ROOT, 'output');
const EXISTING_CSV = path.join(OUTPUT_DIR, 'emissions_data_SIMPLE.csv');
const OUT_CSV = path.join(OUTPUT_DIR, 'emissions_data_JS_OCR.csv');

async function listPdfs(dir) {
  const results = [];
  async function walk(d) {
    let entries;
    try { entries = await fs.readdir(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile() && p.toLowerCase().endsWith('.pdf')) results.push(p);
    }
  }
  await walk(dir);
  return results;
}

async function readProcessedFilenames() {
  try {
    const txt = await fs.readFile(EXISTING_CSV, 'utf8');
    const lines = txt.split(/\r?\n/).filter(Boolean);
    const headers = lines[0].split(',');
    const idx = headers.indexOf('source_file');
    if (idx === -1) return new Set();
    const set = new Set();
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const fname = cols[idx] ? cols[idx].trim().replace(/^"|"$/g, '') : '';
      if (fname) set.add(fname);
    }
    return set;
  } catch (e) {
    return new Set();
  }
}

function csvEscape(s) {
  if (s === null || s === undefined) return '';
  const str = String(s);
  if (str.includes(',') || str.includes('\n') || str.includes('"')) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

async function ensureOutputHeader() {
  // ensure output dir exists
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  } catch (e) {
    // ignore
  }
  try {
    await fs.access(OUT_CSV);
    return;
  } catch {
    const hdr = 'company_name,year,scope,value,unit,source_file,extraction_method\n';
    await fs.writeFile(OUT_CSV, hdr, 'utf8');
  }
}

async function appendRows(rows) {
  if (!rows.length) return;
  const lines = rows.map(r => [r.company_name || '', r.year || '', r.scope || '', r.value || '', r.unit || '', path.basename(r.source_file || ''), 'js:ocr'].map(csvEscape).join(','));
  await fs.appendFile(OUT_CSV, lines.join('\n') + '\n', 'utf8');
}

async function screenshotPdf(page, pdfPath, outImagePath) {
  // Read the PDF file and embed it as a data URL into a minimal HTML page.
  // This avoids Chromium trying to "download" the file when navigating to file:// URLs
  // and lets the built-in PDF renderer show the content so we can screenshot it.
  const buf = await fs.readFile(pdfPath);
  const b64 = buf.toString('base64');
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#fff"><embed src="data:application/pdf;base64,${b64}" type="application/pdf" width="100%" height="1400px"></body></html>`;
  await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 120000 });
  // small wait for renderer
  await page.waitForTimeout(800);
  // set a reasonable viewport and take a screenshot of the page (captures first page)
  await page.setViewportSize({ width: 1400, height: 1400 });
  await page.screenshot({ path: outImagePath, fullPage: true });
}

// NOTE: we use Tesseract.recognize directly below; no worker wrapper is required.

async function run() {
  console.log('Starting JS-OCR pass (Playwright + tesseract.js)');
  const allPdfs = await listPdfs(DOWNLOADS);
  console.log('Found PDFs in downloads:', allPdfs.length);
  const processed = await readProcessedFilenames();
  console.log('Already processed (from CSV):', processed.size);
  const toProcess = allPdfs.filter(p => !processed.has(path.basename(p)));
  console.log('To OCR:', toProcess.length);
  await ensureOutputHeader();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 1600 } });
  const page = await context.newPage();

  // using Tesseract.recognize directly

  const parser = new PDFParser();
  // configure local core and lang paths to avoid network fetches
  const coreDir = path.join(ROOT, 'node_modules', 'tesseract.js-core');
  const corePath = coreDir; // tesseract.js will look for the required files inside this dir
  // langPath: if the environment has tessdata installed locally, point to it; otherwise default to using the package's examples (may fail)
  const localLangPath = path.join(ROOT, 'tessdata');
  const langPathExists = await fs.stat(localLangPath).then(() => true).catch(() => false);
  const langPath = langPathExists ? localLangPath : undefined;

  for (let i = 0; i < toProcess.length; i++) {
    const pdf = toProcess[i];
    console.log(`\n[${i+1}/${toProcess.length}] OCR: ${pdf}`);
    const safeName = path.basename(pdf).replace(/\s+/g, '_');
    const tmpImg = path.join(OUTPUT_DIR, `ocr_${safeName}.png`);
    try {
      await screenshotPdf(page, pdf, tmpImg);
  const recognizeOptions = { logger: m => {} };
  if (corePath) recognizeOptions.corePath = corePath;
  if (langPath) recognizeOptions.langPath = langPath;
  const textResult = await Tesseract.recognize(tmpImg, 'eng', recognizeOptions);
      const text = textResult?.data?.text || '';
      if (!text || text.trim().length === 0) {
        console.log('  No OCR text extracted.');
        continue;
      }
      const recs = parser.extractEmissionsFromText(text);
      if (!recs || recs.length === 0) {
        console.log('  No records found in OCR text.');
      } else {
        // Map recs to CSV rows
        const rows = recs.map(r => ({
          company_name: r.company || '',
          year: r.year || '',
          scope: r.scope || '',
          value: r.value || '',
          unit: r.unit || '',
          source_file: path.basename(pdf)
        }));
        await appendRows(rows);
        console.log(`  Extracted ${rows.length} records -> appended.`);
      }
    } catch (e) {
      console.error('  Error OCRing', e && e.message ? e.message : String(e));
    }
    // small delay between files
    await new Promise(r => setTimeout(r, 400));
  }
  await browser.close();
  console.log('\nJS-OCR pass finished. Output file:', OUT_CSV);
}

run().catch(err => { console.error(err); process.exit(1); });
