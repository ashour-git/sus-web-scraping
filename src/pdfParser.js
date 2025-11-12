import fs from 'fs/promises';
import pdfParse from 'pdf-parse';

export class PDFParser {
  async extractText(pdfPath) {
    try {
      const dataBuffer = await fs.readFile(pdfPath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } catch (error) {
      console.error(`Error parsing PDF ${pdfPath}: ${error.message}`);
      return null;
    }
  }

  async extractEmissionsData(pdfPath) {
    const text = await this.extractText(pdfPath);
    if (!text) return [];

    return this.extractEmissionsFromText(text);
  }

  /**
   * Extract emissions records from already-obtained text (useful for OCR fallbacks)
   */
  extractEmissionsFromText(text) {
    const records = [];
    const lines = (text || '').split(/\r?\n/);
    // Patterns
    const unitFragment = '(?:co2e|co₂e|co2\s*e|co2\-e|co2\s*eq|co₂\s*e|co2eq|tco2e|mtco2e|t|tonnes?|tons?|kt|kg|metric\s*tons?)';
    const numberFragment = '([\\d.,]+)';

    const inlineScopeRegex = new RegExp(`(scope\\s*(1|2|3))\\s*[:\\-]?\\s*${numberFragment}\\s*([a-zA-Z²0-9 /\\-]{0,16}${unitFragment})`, 'ig');
    const totalRegex = new RegExp(`(total\\s+(?:ghg\\s+)?emissions?)\\s*[:\\-]?\\s*${numberFragment}\\s*([a-zA-Z²0-9 /\\-]{0,16}${unitFragment})`, 'ig');
    const multiScopeRegex = /(scope\s*1)\D*?([\d.,]+).*?(scope\s*2)\D*?([\d.,]+).*?(scope\s*3)\D*?([\d.,]+)/i;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i] || '';
      const line = rawLine.toLowerCase();

      // Inline scoped values
      let match;
      inlineScopeRegex.lastIndex = 0;
      while ((match = inlineScopeRegex.exec(line)) !== null) {
        const foundScope = `Scope ${match[2]}`;
        const rawValue = match[3];
        const unitRaw = match[4] || '';
        const year = this.extractYearWithContext(lines, i) || 'Unknown';
        const { unit, value } = this.normalizeUnitAndValue(unitRaw, rawValue);
        if (value !== null) {
          records.push({
            source: null,
            year,
            scope: foundScope,
            category: this.extractCategory(line),
            value,
            unit,
            rawText: rawLine.trim()
          });
        }
      }

      // Totals
      totalRegex.lastIndex = 0;
      while ((match = totalRegex.exec(line)) !== null) {
        const rawValue = match[2];
        const unitRaw = match[3] || '';
        const year = this.extractYearWithContext(lines, i) || 'Unknown';
        const { unit, value } = this.normalizeUnitAndValue(unitRaw, rawValue);
        if (value !== null) {
          records.push({
            source: null,
            year,
            scope: 'Total',
            category: this.extractCategory(line),
            value,
            unit,
            rawText: rawLine.trim()
          });
        }
      }

      // Multi-scope row (single line)
      const multi = line.match(multiScopeRegex);
      if (multi) {
        const pairs = [
          { scope: 'Scope 1', rawValue: multi[2] },
          { scope: 'Scope 2', rawValue: multi[4] },
          { scope: 'Scope 3', rawValue: multi[6] }
        ];
        const year = this.extractYearWithContext(lines, i) || 'Unknown';
        const unitRaw = this.extractUnit(rawLine);
        for (const p of pairs) {
          const { unit, value } = this.normalizeUnitAndValue(unitRaw, p.rawValue);
          if (value !== null) {
            records.push({
              source: null,
              year,
              scope: p.scope,
              category: this.extractCategory(line),
              value,
              unit,
              rawText: rawLine.trim()
            });
          }
        }
      }

      // Fallback: generic emission keywords with a number
      const hasKw = /(scope\s*[123]|emissions|ghg|co2|co₂|tco2e|tonnes|tons|mt\b|kt\b|mtco2e|co2e|co2\-e|co2\s*eq)/i.test(line);
      const numbers = rawLine.match(/[\d,]+\.?\d*/g);
      if (hasKw && numbers && numbers.length > 0) {
        const inferredScope = this.inferScopeFromContext(lines, i) || this.extractScope(line) || 'Unknown';
        const year = this.extractYearWithContext(lines, i) || 'Unknown';
        const { unit, value } = this.normalizeUnitAndValue(this.extractUnit(rawLine), numbers[0]);
        if (value !== null) {
          records.push({
            source: null,
            year,
            scope: inferredScope,
            category: this.extractCategory(line),
            value,
            unit,
            rawText: rawLine.trim()
          });
        }
      }
    }

    return records;
  }

  extractYear(text) {
    const fy = /(fy)\s*20(\d{2})\s*[\/\-–]\s*20(\d{2})/i.exec(text || '');
    if (fy) return `20${fy[3]}`;
    const span = /20(\d{2})\s*[\/\-–]\s*20(\d{2})/i.exec(text || '');
    if (span) return `20${span[2]}`;
    const yearMatch = (text || '').match(/\b(19|20)\d{2}\b/);
    return yearMatch ? yearMatch[0] : null;
  }

  extractScope(text) {
    const lowerText = (text || '').toLowerCase();
    if (lowerText.includes('scope 1')) return 'Scope 1';
    if (lowerText.includes('scope 2')) return 'Scope 2';
    if (lowerText.includes('scope 3')) return 'Scope 3';
    return null;
  }

  extractCategory(text) {
    const lowerText = (text || '').toLowerCase();
    if (lowerText.includes('direct')) return 'Direct Emissions';
    if (lowerText.includes('indirect')) return 'Indirect Emissions';
    if (lowerText.includes('energy')) return 'Energy';
    if (lowerText.includes('transport')) return 'Transportation';
    return 'General';
  }

  extractUnit(text) {
    const t = (text || '').toLowerCase();
    if (/(mtco2e|mt\s*co2e)/.test(t)) return 'MT CO2e';
    if (/(tco2e|t\s*co2e|co2e|co₂e|co2\-e|co2\s*eq)/.test(t)) return 'tCO2e';
    if (/\bkt\b/.test(t)) return 'kt';
    if (/tonnes?\s*co2e|\btonnes?\b/.test(t)) return 'tonnes';
    if (/\btons\b/.test(t)) return 'tons';
    if (/metric\s*tons?/.test(t)) return 'Metric Tons';
    if (/\bkg\b/.test(t)) return 'kg';
    return 'Unknown';
  }

  extractYearWithContext(lines, centerIdx) {
    for (let delta = 0; delta <= 3; delta++) {
      const up = centerIdx - delta;
      const down = centerIdx + delta;
      if (up >= 0) {
        const y = this.extractYear(lines[up]);
        if (y) return y;
      }
      if (down < lines.length) {
        const y = this.extractYear(lines[down]);
        if (y) return y;
      }
    }
    return null;
  }

  inferScopeFromContext(lines, centerIdx) {
    for (let delta = 1; delta <= 3; delta++) {
      const up = centerIdx - delta;
      const down = centerIdx + delta;
      if (up >= 0) {
        const s = this.extractScope(lines[up]);
        if (s) return s;
      }
      if (down < lines.length) {
        const s = this.extractScope(lines[down]);
        if (s) return s;
      }
    }
    return null;
  }

  normalizeUnitAndValue(unitRaw, rawValue) {
    if (!rawValue && rawValue !== 0) return { unit: 'Unknown', value: null };
    const valueNum = parseFloat(String(rawValue).replace(/,/g, ''));
    if (!isFinite(valueNum) || valueNum <= 0) return { unit: 'Unknown', value: null };

    const u = (unitRaw || '').toString().toLowerCase();
    if (/\bkt\b/.test(u)) return { unit: 'MT CO2e', value: valueNum * 1000 };
    if (/(tco2e|mtco2e|tonnes?|tons?|metric\s*tons?)/.test(u)) return { unit: 'MT CO2e', value: valueNum };
    if (/\bmegaton[s]?\b|\bmega\s*tons?\b/.test(u)) return { unit: 'MT CO2e', value: valueNum * 1_000_000 };
    if (/\bkg\b/.test(u)) return { unit: 'MT CO2e', value: valueNum / 1000 };
    return { unit: 'Unknown', value: valueNum };
  }

  extractCompanyFromText(text) {
    const doc = (text || '');
    const first = doc.substring(0, 16000);
    const legal = first.match(/\b([A-Z][A-Za-z&\-\s]{2,}?)\s+(Inc\.?|Incorporated|LLC\.?|Corporation|Corp\.?|PLC\.?|P\.L\.C\.?|PJS?C\.?|S\.A\.?E\.?|S\.A\.?|AG|GmbH|NV|N\.V\.?|B\.V\.?|Group|Holdings?|Bank|Company|Co\.?|Limited|Ltd\.?|S\.p\.A\.?|Srl|A\/S|AB|SE|KGaA)\b/);
    if (legal) return legal[0].trim().replace(/\s{2,}/g, ' ');

    const blacklist = /(sustainability|integrated|annual|impact|report|summary|table\s+of\s+contents|contents|index|environmental|governance|social|esg|year)/i;

    const lines = first.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const freq = new Map();
    for (const l of lines) freq.set(l, (freq.get(l) || 0) + 1);

    let best = null;
    let bestScore = -Infinity;
    for (const l of lines) {
      if (l.length < 3 || l.length > 80) continue;
      if (/\d{3,}/.test(l)) continue; // avoid heavy numeric lines
      const words = l.split(/\s+/);
      const titleish = words.filter(w => /^[A-Z][A-Za-z&\-]+$/.test(w)).length / Math.max(1, words.length);
      const hasLegal = /(Inc\.?|LLC\.?|PLC\.?|P\.L\.C\.?|PJS?C\.?|S\.A\.?E\.?|S\.A\.?|AG|GmbH|NV|N\.V\.?|B\.V\.?|Group|Holdings?|Bank|Company|Co\.?|Limited|Ltd\.?|S\.p\.A\.?|Srl|A\/S|AB|SE|KGaA)\b/.test(l);
      let score = 0;
      score += hasLegal ? 3 : 0;
      score += titleish >= 0.6 ? 2 : 0;
      score += (freq.get(l) || 0) > 1 ? 1 : 0;
      if (blacklist.test(l)) score -= 3;
      if (score > bestScore) {
        bestScore = score;
        best = l;
      }
    }
    return best || null;
  }

  async parseAllPDFs(downloadedFiles) {
    const allRecords = [];

    for (const file of downloadedFiles) {
      console.log(`\n📄 Parsing: ${file.filename}`);
      const records = await this.extractEmissionsData(file.filepath);

      records.forEach(record => {
        record.company = this.extractCompanyName(file.sourcePage);
        record.sourceFile = file.filename;
      });

      allRecords.push(...records);
      console.log(`  Found ${records.length} emission records`);
    }

    return allRecords;
  }

  extractCompanyName(url) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      const parts = domain.split('.');
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    } catch {
      return 'Unknown';
    }
  }
}
