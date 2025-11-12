#!/usr/bin/env node

/**
 * Dual CSV Extractor v2 (improved)
 * - Extracts emissions from PDFs using a multi-stage approach:
 *   1) Primary text extraction via src/pdfParser.js
 *   2) Regex fallback on raw text (broader coverage)
 *   3) Table extraction via Python/pdfplumber (if available)
 *   4) OCR fallback using Tesseract (if poppler+tesseract are available)
 *
 * Output CSV schema (exact):
 *   Company Name,Year,Emission Scope,Emissions,GHG Unit,Country,Data Source
 *
 * Usage:
 *   node extract_dual_csvs.js
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { PDFParser } from './src/pdfParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, 'output');
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
const EGYPT_DIR = path.join(DOWNLOADS_DIR, 'Egypt Sustainability Reports');

const REQUIRED_HEADERS = [
  'Company Name',
  'Year',
  'Emission Scope',
  'Emissions',
  'GHG Unit',
  'Country',
  'Data Source'
];

const primaryParser = new PDFParser();

// --- Utilities ---
async function listPdfsRecursive(dir) {
  const acc = [];
  try {
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const it of items) {
      const full = path.join(dir, it.name);
      if (it.isDirectory()) {
        acc.push(...await listPdfsRecursive(full));
      } else if (it.isFile() && it.name.toLowerCase().endsWith('.pdf')) {
        acc.push(full);
      }
    }
  } catch {
    // ignore
  }
  return acc;
}

function guessCompanyFromFilename(filename) {
  let cleaned = filename.replace(/\.pdf$/i, '').replace(/[_.-]+/g, ' ');
  cleaned = cleaned.replace(/\b(annual|integrated|impact|sustainability|jaarverslag|jaar|esg|summary|final|report|reports|lr)\b/gi, '');
  cleaned = cleaned.replace(/\b(\d{4}|20\d{2})\b/g, '');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  return cleaned.split(' ').map(w => w ? (w[0].toUpperCase() + w.slice(1)) : '').join(' ').trim() || 'Unknown';
}

function inferYearFromText(text) {
  const years = [...(text || '').matchAll(/\b(20\d{2}|19\d{2})\b/g)].map(m => parseInt(m[1], 10));
  if (!years.length) return null;
  const filtered = years.filter(y => y >= 2010 && y <= 2026);
  const list = filtered.length ? filtered : years;
  const freq = new Map();
  for (const y of list) freq.set(y, (freq.get(y) || 0) + 1);
  let best = null; let bestCount = -1;
  for (const [y, c] of freq.entries()) {
    if (c > bestCount || (c === bestCount && y > best)) { best = y; bestCount = c; }
  }
  return best;
}

function inferYearFromFilename(name) {
  const m = name.match(/\b(20\d{2}|19\d{2})\b/);
  return m ? parseInt(m[1], 10) : null;
}

function normalizeUnitAndValue(unitRaw, valueRaw) {
  if (valueRaw == null) return { unit: 'Unknown', value: null };
  const v = parseFloat(String(valueRaw).replace(/,/g, ''));
  if (!isFinite(v) || v <= 0) return { unit: 'Unknown', value: null };
  const u = (unitRaw || '').toString().toLowerCase();
  // Normalize to metric tons CO2e
  if (/kt/.test(u)) return { unit: 'MT CO2e', value: v * 1000 };
  if (/tco2e|mtco2e|tonne|tons?|metric\s*tons?/.test(u)) return { unit: 'MT CO2e', value: v };
  if (/\bmegaton[s]?\b|\bmega\s*tons?\b/.test(u)) return { unit: 'MT CO2e', value: v * 1_000_000 };
  if (/\bkg\b/.test(u)) return { unit: 'MT CO2e', value: v / 1000 };
  return { unit: 'Unknown', value: v };
}

function csvEscape(val) {
  if (val == null) return '';
  const s = String(val);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// --- Fallback extractors ---
function fallbackExtractFromText(text, sourceFile) {
  const patterns = [
    { name: 'scope-colon-value-unit', regex: /(Scope\s*[123])\s*[:\-]\s*([\d,.]+)\s*(tco2e|mt\s*co2e|mtco2e|t|tonnes?|tons?|kt|kg)/gi, fields: ['scope','value','unit'] },
    { name: 'scope-emissions', regex: /(Scope\s*[123])\s+emissions?\s*[:\-]?\s*([\d,.]+)\s*(tco2e|mt\s*co2e|mtco2e|t|tonnes?|tons?|kt|kg)/gi, fields: ['scope','value','unit'] },
    { name: 'total-emissions', regex: /(total\s+(?:ghg\s+)?emissions?)\s*[:\-]?\s*([\d,.]+)\s*(tco2e|mt\s*co2e|mtco2e|t|tonnes?|tons?|kt|kg)/gi, fields: ['_','value','unit'], scope: 'Total' },
    { name: 'inline-scope', regex: /(scope\s*[123]).{0,12}?([\d,.]+)\s*(tco2e|mt\s*co2e|mtco2e|t|tonnes?|tons?|kt|kg)/gi, fields: ['scope','value','unit'] }
  ];
  const results = [];
  const year = inferYearFromText(text) || null;
  for (const p of patterns) {
    const matches = text.matchAll(p.regex);
    for (const m of matches) {
      const scopeRaw = p.scope || m[p.fields.indexOf('scope') + 1] || 'Unknown';
      const valueRaw = m[p.fields.indexOf('value') + 1];
      const unitRaw = m[p.fields.indexOf('unit') + 1] || 'tCO2e';
      const { unit, value } = normalizeUnitAndValue(unitRaw, valueRaw);
      if (value == null) continue;
      const scopeNorm = scopeRaw.toLowerCase().includes('1') ? 'Scope 1'
        : scopeRaw.toLowerCase().includes('2') ? 'Scope 2'
        : scopeRaw.toLowerCase().includes('3') ? 'Scope 3' : 'Total';
      results.push({ year, scope: scopeNorm, value, unit, source_file: sourceFile, extraction_method: `fallback:${p.name}` });
    }
  }
  return results;
}

function extractYearSafe(text, filename, existingYear) {
  return existingYear || inferYearFromText(text) || inferYearFromFilename(filename) || new Date().getFullYear();
}

async function extractTables(pdfPath) {
  const pyPath = path.join(__dirname, 'extract_tables.py');
  let out = [];
  try {
    const res = spawnSync('python', [pyPath, pdfPath], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    if (res.status === 0 && res.stdout) {
      const parsed = JSON.parse(res.stdout);
      if (Array.isArray(parsed)) out = parsed;
    } else {
      // try 'py' launcher on Windows
      const res2 = spawnSync('py', ['-3', pyPath, pdfPath], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
      if (res2.status === 0 && res2.stdout) {
        const parsed = JSON.parse(res2.stdout);
        if (Array.isArray(parsed)) out = parsed;
      }
    }
  } catch (e) {
    // ignore missing python/pdfplumber
  }
  return out;
}

async function extractWithOCR(pdfPath) {
  try {
    const mod = await import('./extract_with_ocr.js');
    const fn = mod && mod.default ? mod.default : null;
    if (!fn) return [];
    const recs = await fn(pdfPath);
    return Array.isArray(recs) ? recs : [];
  } catch (e) {
    return [];
  }
}

async function processOne(pdfPath, country, dataSource) {
  const sourceFile = path.basename(pdfPath);
  const companyCandidateFromFile = guessCompanyFromFilename(sourceFile);
  const results = [];

  // 1) Get raw text once
  const text = await primaryParser.extractText(pdfPath);

  // 2) Primary extraction
  if (text) {
    const primary = primaryParser.extractEmissionsFromText(text) || [];
    for (const r of primary) {
      const y = r.year && r.year !== 'Unknown' ? parseInt(r.year, 10) : extractYearSafe(text, sourceFile);
      const { unit, value } = normalizeUnitAndValue(r.unit || 'tCO2e', r.value);
      if (value != null) {
        results.push({
          company: primaryParser.extractCompanyFromText(text) || companyCandidateFromFile,
          year: y,
          scope: r.scope || 'Unknown',
          emissions: value,
          unit: unit || 'MT CO2e',
          country,
          dataSource: sourceFile,
          sourceFile,
          method: 'primary:pdfParser'
        });
      }
    }
  }

  // 3) Fallback regex on text
  if (results.length === 0 && text) {
    const fb = fallbackExtractFromText(text, sourceFile);
    for (const r of fb) {
      const y = extractYearSafe(text, sourceFile, r.year);
      results.push({
        company: primaryParser.extractCompanyFromText(text) || companyCandidateFromFile,
        year: y,
        scope: r.scope,
        emissions: r.value,
        unit: r.unit || 'MT CO2e',
        country,
        dataSource: sourceFile,
        sourceFile,
        method: r.extraction_method
      });
    }
  }

  // 4) Table extraction (Python/pdfplumber)
  if (results.length === 0) {
    const tableRecords = await extractTables(pdfPath);
    if (Array.isArray(tableRecords) && tableRecords.length > 0) {
      const y = text ? extractYearSafe(text, sourceFile) : (inferYearFromFilename(sourceFile) || new Date().getFullYear());
      for (const tr of tableRecords) {
        const { unit, value } = normalizeUnitAndValue(tr.unit || 'tCO2e', tr.value);
        if (value == null) continue;
        results.push({
          company: (text && primaryParser.extractCompanyFromText(text)) || companyCandidateFromFile,
          year: tr.year || y,
          scope: tr.scope || 'Unknown',
          emissions: value,
          unit: unit || 'MT CO2e',
          country,
          dataSource: sourceFile,
          sourceFile,
          method: 'table:pdfplumber'
        });
      }
    }
  }

  // 5) OCR fallback
  if (results.length === 0) {
    const ocr = await extractWithOCR(pdfPath);
    if (Array.isArray(ocr) && ocr.length > 0) {
      const y = text ? extractYearSafe(text, sourceFile) : (inferYearFromFilename(sourceFile) || new Date().getFullYear());
      for (const r of ocr) {
        const { unit, value } = normalizeUnitAndValue(r.unit || 'tCO2e', r.value);
        if (value == null) continue;
        results.push({
          company: (text && primaryParser.extractCompanyFromText(text)) || companyCandidateFromFile,
          year: r.year || y,
          scope: r.scope || 'Unknown',
          emissions: value,
          unit: unit || 'MT CO2e',
          country,
          dataSource: sourceFile,
          sourceFile,
          method: 'ocr:tesseract'
        });
      }
    }
  }

  return results;
}

function dedupeAndNormalize(records) {
  const keyMap = new Map();
  for (const r of records) {
    const key = `${r.company}|${r.year}|${r.scope}`;
    if (!keyMap.has(key) || (r.emissions || 0) > (keyMap.get(key).emissions || 0)) {
      keyMap.set(key, r);
    }
  }
  return Array.from(keyMap.values());
}

function cleanCompany(name, fallback) {
  if (!name) return fallback || 'Unknown';
  let s = String(name).replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (s.length > 80) return fallback || 'Unknown';
  const blacklist = /^(about|introduction|overview|management|ownership|voorwoord|vorwort|being a b corp|als b corp|een b corp|company financial statements|letter from|together with|designing\s+efficient\s+data\s+centers|report\s+parameters|the bank)$/i;
  if (blacklist.test(s)) return fallback || 'Unknown';
  return s;
}

function validateAndClean(records) {
  const cleaned = [];
  for (const r of records) {
    const year = parseInt(r.year, 10);
    if (!isFinite(year) || year < 2005 || year > 2026) continue;
    if (!r.scope || !/^(Scope 1|Scope 2|Scope 3|Total)$/i.test(r.scope)) continue;
    const unit = r.unit && r.unit !== 'Unknown' ? r.unit : 'MT CO2e';
    const s = String(r.emissions);
    if (/e[+\-]?\d+/i.test(s)) continue; // drop scientific notation noise
    const v = Number(r.emissions);
    if (!isFinite(v) || v <= 0) continue;
    if (Number.isInteger(v) && v >= 1900 && v <= 2100) continue; // looks like year
    if (v > 5e8) continue; // implausible
    const fallback = guessCompanyFromFilename(r.sourceFile || '');
    const company = cleanCompany(r.company, fallback);
    if (!company || company === 'Unknown') continue;
    cleaned.push({
      company,
      year,
      scope: /total/i.test(r.scope) ? 'Total' : r.scope,
      emissions: v,
      unit: unit,
      country: r.country || 'Unknown',
      dataSource: r.sourceFile || '',
      sourceFile: r.sourceFile || ''
    });
  }
  return cleaned;
}

async function writeCsv(records, outPath) {
  const header = REQUIRED_HEADERS.join(',');
  const lines = [header];
  for (const r of records) {
    lines.push([
      csvEscape(r.company || ''),
      csvEscape(r.year || ''),
      csvEscape(r.scope || ''),
      csvEscape(r.emissions != null ? r.emissions : ''),
      csvEscape(r.unit || ''),
      csvEscape(r.country || ''),
      csvEscape(r.dataSource || '')
    ].join(','));
  }
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, lines.join('\n'));
}

async function main() {
  console.log('🔎 Scanning PDF locations...');
  const allDownloads = await listPdfsRecursive(DOWNLOADS_DIR);

  const egyptPrefix = EGYPT_DIR + path.sep;
  const egyptPdfs = allDownloads.filter(p => p.startsWith(egyptPrefix));
  const nonEgyptPdfs = allDownloads.filter(p => !p.startsWith(egyptPrefix));

  console.log(`Found ${nonEgyptPdfs.length} PDFs in downloads (excluding Egypt folder).`);
  console.log(`Found ${egyptPdfs.length} PDFs in Egypt Sustainability Reports.`);

  const nonEgyptRecords = [];
  for (const p of nonEgyptPdfs) {
    try {
      const recs = await processOne(p, 'Unknown', 'downloads');
      if (recs.length) nonEgyptRecords.push(...recs);
    } catch (e) {
      console.warn(`Failed processing ${path.basename(p)}: ${e.message}`);
    }
  }

  const egyptRecords = [];
  for (const p of egyptPdfs) {
    try {
      const recs = await processOne(p, 'Egypt', 'Egypt Sustainability Reports');
      if (recs.length) egyptRecords.push(...recs);
    } catch (e) {
      console.warn(`Failed processing ${path.basename(p)}: ${e.message}`);
    }
  }

  const nonEgyptClean = dedupeAndNormalize(validateAndClean(nonEgyptRecords));
  const egyptClean = dedupeAndNormalize(validateAndClean(egyptRecords));

  const outNonEgypt = path.join(OUTPUT_DIR, 'downloads_emissions_extracted.csv');
  const outEgypt = path.join(OUTPUT_DIR, 'egypt_emissions_extracted.csv');
  await writeCsv(nonEgyptClean, outNonEgypt);
  await writeCsv(egyptClean, outEgypt);

  console.log('\n✅ Extraction complete.');
  console.log(` - Downloads CSV: ${outNonEgypt}`);
  console.log(` - Egypt CSV:     ${outEgypt}`);
  console.log(`   Totals => downloads: ${nonEgyptClean.length}, egypt: ${egyptClean.length}`);
}

main().catch(err => {
  console.error('❌ Extraction failed:', err);
  process.exit(1);
});
