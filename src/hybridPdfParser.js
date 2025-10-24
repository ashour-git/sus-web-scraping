import fs from 'fs/promises';
import pdfParse from 'pdf-parse';

/**
 * HYBRID PDF PARSER - ULTRATHINK APPROACH
 *
 * Strategy: Extract VOLUME of emissions-related data with SMART validation
 * - More relaxed than improvedParser (gets volume)
 * - Smarter than original parser (better quality)
 * - Accepts records with EITHER unit OR contextual indicators
 * - Infers missing fields from surrounding context
 * - Goal: 1000+ records with 50%+ quality rate
 */
export class HybridPDFParser {
  constructor() {
    // Emission indicators (broader than strict units)
    this.emissionIndicators = [
      // Direct units
      /(\d[\d,\.]*)\s*(tCO2e?|tonnes?\s+CO2e?|MT\s+CO2e?|ktCO2e?|MtCO2e?|kg\s+CO2e?|metric\s+tons?\s+CO2e?)/gi,

      // Contextual patterns
      /emissions?:\s*(\d[\d,\.]*)/gi,
      /total\s+(?:ghg|emissions?):\s*(\d[\d,\.]*)/gi,
      /carbon\s+footprint:\s*(\d[\d,\.]*)/gi,
      /(\d[\d,\.]*)\s*(?:million|thousand)?\s*(?:metric\s+)?tons?/gi,

      // Scope patterns
      /scope\s*[123][\s:]+(\d[\d,\.]*)/gi,
      /scope\s*[123].*?(\d[\d,\.]*)\s*(?:tCO2e?|tonnes?|MT)/gi
    ];

    // Year range
    this.minYear = 2015;  // Relaxed from 2000
    this.maxYear = 2030;  // Relaxed to include targets

    // Value range (more permissive)
    this.minValue = 0.01;  // Allow small values
    this.maxValue = 50000000; // 50M tonnes (higher ceiling)
  }

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

  /**
   * MAIN EXTRACTION - Multi-strategy approach
   */
  async extractEmissionsData(pdfPath) {
    const text = await this.extractText(pdfPath);
    if (!text) return [];

    const records = [];

    // Strategy 1: Extract from structured tables
    const tableRecords = this.extractFromTables(text, pdfPath);
    records.push(...tableRecords);

    // Strategy 2: Extract from emission statements
    const statementRecords = this.extractFromStatements(text, pdfPath);
    records.push(...statementRecords);

    // Strategy 3: Extract from scope sections
    const scopeRecords = this.extractFromScopeSections(text, pdfPath);
    records.push(...scopeRecords);

    // Deduplicate
    return this.deduplicateRecords(records);
  }

  /**
   * Strategy 1: Extract from table-like structures
   */
  extractFromTables(text, pdfPath) {
    const records = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const prevLine = i > 0 ? lines[i - 1] : '';
      const nextLine = i < lines.length - 1 ? lines[i + 1] : '';

      // Look for table rows with multiple data points
      if (this.looksLikeTableRow(line)) {
        const record = this.parseTableRow(line, prevLine, nextLine);
        if (record) {
          record.source = pdfPath;
          record.extractionMethod = 'table';
          records.push(record);
        }
      }
    }

    return records;
  }

  /**
   * Strategy 2: Extract from emission statements
   */
  extractFromStatements(text, pdfPath) {
    const records = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const context = this.getContext(lines, i, 3);

      // Look for emission statements
      for (const pattern of this.emissionIndicators) {
        const matches = [...line.matchAll(new RegExp(pattern.source, pattern.flags))];

        for (const match of matches) {
          const valueStr = match[1];
          const unit = match[2] || this.inferUnitFromContext(context);

          if (valueStr) {
            const value = this.parseValue(valueStr);

            if (value && value >= this.minValue && value <= this.maxValue) {
              const record = {
                year: this.extractYear(context) || 'Recent',
                scope: this.extractScope(context) || 'Total',
                category: this.extractCategory(context),
                value: value,
                unit: unit || 'tonnes CO2e',
                source: pdfPath,
                rawText: line.trim().substring(0, 200),
                extractionMethod: 'statement',
                confidence: this.calculateConfidence(line, unit, context)
              };

              if (record.confidence >= 0.3) { // 30% confidence minimum
                records.push(record);
              }
            }
          }
        }
      }
    }

    return records;
  }

  /**
   * Strategy 3: Extract from scope-specific sections
   */
  extractFromScopeSections(text, pdfPath) {
    const records = [];
    const scopePatterns = [
      { scope: 'Scope 1', pattern: /scope\s*1[^\n]{0,500}?(\d[\d,\.]+)\s*(tCO2e?|tonnes?|MT)?/gi },
      { scope: 'Scope 2', pattern: /scope\s*2[^\n]{0,500}?(\d[\d,\.]+)\s*(tCO2e?|tonnes?|MT)?/gi },
      { scope: 'Scope 3', pattern: /scope\s*3[^\n]{0,500}?(\d[\d,\.]+)\s*(tCO2e?|tonnes?|MT)?/gi }
    ];

    for (const { scope, pattern } of scopePatterns) {
      const matches = [...text.matchAll(pattern)];

      for (const match of matches) {
        const valueStr = match[1];
        const unit = match[2] || 'tonnes CO2e';
        const value = this.parseValue(valueStr);

        if (value && value >= this.minValue && value <= this.maxValue) {
          const contextStart = Math.max(0, match.index - 200);
          const contextEnd = Math.min(text.length, match.index + 200);
          const context = text.substring(contextStart, contextEnd);

          records.push({
            year: this.extractYear(context) || 'Recent',
            scope: scope,
            category: this.extractCategory(context),
            value: value,
            unit: unit,
            source: pdfPath,
            rawText: match[0].substring(0, 200),
            extractionMethod: 'scope-section',
            confidence: 0.6
          });
        }
      }
    }

    return records;
  }

  /**
   * Check if line looks like a table row
   */
  looksLikeTableRow(line) {
    // Has multiple numbers separated by spaces/tabs
    const numbers = line.match(/\b\d[\d,\.]*\b/g);
    if (!numbers || numbers.length < 2) return false;

    // Has emission-related keywords
    const keywords = ['scope', 'emissions', 'co2', 'ghg', 'carbon', 'total'];
    const hasKeyword = keywords.some(kw => line.toLowerCase().includes(kw));

    return hasKeyword && numbers.length >= 2;
  }

  /**
   * Parse table row
   */
  parseTableRow(line, prevLine, nextLine) {
    const context = `${prevLine}\n${line}\n${nextLine}`;

    // Extract all numbers from the line
    const numbers = line.match(/\b(\d[\d,\.]*)\b/g);
    if (!numbers || numbers.length < 2) return null;

    // Try to identify which number is the emission value
    let value = null;
    let year = null;

    for (const numStr of numbers) {
      const num = this.parseValue(numStr);

      // Check if it's a year
      if (num >= this.minYear && num <= this.maxYear && num.toString().length === 4) {
        year = num.toString();
      }
      // Check if it's an emission value
      else if (num >= this.minValue && num <= this.maxValue) {
        value = num;
      }
    }

    if (!value) return null;

    return {
      year: year || 'Recent',
      scope: this.extractScope(context) || 'Total',
      category: this.extractCategory(context),
      value: value,
      unit: this.inferUnitFromContext(context),
      rawText: line.trim().substring(0, 200),
      confidence: 0.5
    };
  }

  /**
   * Get surrounding context
   */
  getContext(lines, index, range = 2) {
    const start = Math.max(0, index - range);
    const end = Math.min(lines.length, index + range + 1);
    return lines.slice(start, end).join('\n');
  }

  /**
   * Extract year from context
   */
  extractYear(text) {
    const yearPattern = /\b(20[0-3][0-9])\b/g;
    const matches = text.match(yearPattern);

    if (!matches) return null;

    // Filter valid years
    const validYears = matches
      .map(y => parseInt(y))
      .filter(y => y >= this.minYear && y <= this.maxYear);

    // Return most common year, or latest
    if (validYears.length > 0) {
      return validYears[validYears.length - 1].toString();
    }

    return null;
  }

  /**
   * Extract scope from context
   */
  extractScope(text) {
    const lower = text.toLowerCase();

    if (lower.includes('scope 1') || lower.includes('scope1')) return 'Scope 1';
    if (lower.includes('scope 2') || lower.includes('scope2')) return 'Scope 2';
    if (lower.includes('scope 3') || lower.includes('scope3')) return 'Scope 3';
    if (lower.includes('total') && lower.includes('emission')) return 'Total';

    return null;
  }

  /**
   * Extract category from context
   */
  extractCategory(text) {
    const lower = text.toLowerCase();

    if (lower.includes('direct')) return 'Direct Emissions';
    if (lower.includes('indirect')) return 'Indirect Emissions';
    if (lower.includes('energy')) return 'Energy';
    if (lower.includes('transport') || lower.includes('travel')) return 'Transportation';
    if (lower.includes('waste')) return 'Waste';
    if (lower.includes('purchased goods')) return 'Purchased Goods';
    if (lower.includes('supply chain')) return 'Supply Chain';

    return 'General';
  }

  /**
   * Infer unit from context
   */
  inferUnitFromContext(text) {
    const lower = text.toLowerCase();

    if (lower.includes('mtco2e') || lower.includes('mt co2e')) return 'MT CO2e';
    if (lower.includes('ktco2e') || lower.includes('kt co2e') || lower.includes('kiloton')) return 'kt CO2e';
    if (lower.includes('mtco2e') && (lower.includes('million') || lower.includes('mega'))) return 'Mt CO2e';
    if (lower.includes('tco2e') || lower.includes('tonnes co2e') || lower.includes('tons co2e')) return 'tonnes CO2e';
    if (lower.includes('kg co2e')) return 'kg CO2e';

    return 'tonnes CO2e'; // Default assumption
  }

  /**
   * Parse value string to number
   */
  parseValue(valueStr) {
    if (!valueStr) return null;

    const cleaned = valueStr.replace(/,/g, '');
    const num = parseFloat(cleaned);

    return isNaN(num) ? null : num;
  }

  /**
   * Calculate confidence score (0-1)
   */
  calculateConfidence(line, unit, context) {
    let score = 0.3; // Base score

    // Has explicit unit
    if (unit && unit !== 'tonnes CO2e') score += 0.3;

    // Has scope mentioned
    if (this.extractScope(context)) score += 0.2;

    // Has year mentioned
    if (this.extractYear(context)) score += 0.1;

    // Has emission keywords
    const keywords = ['emission', 'ghg', 'carbon', 'co2'];
    if (keywords.some(kw => line.toLowerCase().includes(kw))) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Deduplicate records
   */
  deduplicateRecords(records) {
    const seen = new Set();
    return records.filter(record => {
      const key = `${record.year}|${record.scope}|${record.value}|${record.category}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Parse all PDFs
   */
  async parseAllPDFs(downloadedFiles) {
    const allRecords = [];

    console.log('\n🚀 HYBRID PDF PARSER - ULTRATHINK MODE\n');
    console.log('Strategy: Volume + Quality = Extract MORE data with SMART validation');
    console.log('='.repeat(70));
    console.log('\n📋 Extraction Strategies:');
    console.log('  1. Table extraction - Structured data rows');
    console.log('  2. Statement extraction - Emission declarations');
    console.log('  3. Scope section extraction - Scope 1/2/3 specific data');
    console.log('\n🎯 Validation:');
    console.log('  • Year: 2015-2030 (includes targets)');
    console.log('  • Value: 0.01 - 50M tonnes');
    console.log('  • Confidence: Minimum 30%');
    console.log('  • Unit: Explicit or inferred from context\n');

    for (const file of downloadedFiles) {
      console.log(`\n📄 Processing: ${file.filename}`);
      const records = await this.extractEmissionsData(file.filepath);

      // Add company and source info
      records.forEach(record => {
        record.company = this.extractCompanyName(file.sourcePage);
        record.sourceFile = file.filename;
      });

      allRecords.push(...records);

      const highConf = records.filter(r => r.confidence >= 0.6).length;
      const medConf = records.filter(r => r.confidence >= 0.4 && r.confidence < 0.6).length;
      const lowConf = records.filter(r => r.confidence < 0.4).length;

      console.log(`  ✅ Found ${records.length} records`);
      if (records.length > 0) {
        console.log(`     High confidence (60%+): ${highConf}`);
        console.log(`     Medium confidence (40-60%): ${medConf}`);
        console.log(`     Low confidence (<40%): ${lowConf}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`📊 HYBRID PARSER RESULTS:`);
    console.log(`   Total records extracted: ${allRecords.length}`);

    const byConfidence = {
      high: allRecords.filter(r => r.confidence >= 0.6).length,
      medium: allRecords.filter(r => r.confidence >= 0.4 && r.confidence < 0.6).length,
      low: allRecords.filter(r => r.confidence < 0.4).length
    };

    console.log(`   High confidence (60%+): ${byConfidence.high} (${(byConfidence.high/allRecords.length*100).toFixed(1)}%)`);
    console.log(`   Medium confidence (40-60%): ${byConfidence.medium} (${(byConfidence.medium/allRecords.length*100).toFixed(1)}%)`);
    console.log(`   Low confidence (<40%): ${byConfidence.low} (${(byConfidence.low/allRecords.length*100).toFixed(1)}%)`);
    console.log('='.repeat(70) + '\n');

    return allRecords;
  }

  /**
   * Extract company name from source
   */
  extractCompanyName(url) {
    if (typeof url !== 'string') return 'Unknown';

    const lower = url.toLowerCase();

    if (lower.includes('tadawul') || lower.includes('stg_sr24')) return 'Tadawul';
    if (lower.includes('nasdaq') && lower.includes('dubai')) return 'NASDAQ Dubai';
    if (lower.includes('lseg')) return 'LSEG';
    if (lower.includes('pwc')) return 'PwC';
    if (lower.includes('contact') && lower.includes('egypt')) return 'Contact Egypt';
    if (lower.includes('abn') || lower.includes('amro')) return 'ABN AMRO';
    if (lower.includes('albert') || lower.includes('heijn')) return 'Albert Heijn';
    if (lower.includes('apple')) return 'Apple';
    if (lower.includes('google')) return 'Google';
    if (lower.includes('tesla')) return 'Tesla';
    if (lower.includes('heineken')) return 'Heineken';
    if (lower.includes('philips')) return 'Philips';
    if (lower.includes('ing')) return 'ING';
    if (lower.includes('kpn')) return 'KPN';

    return 'Various Companies';
  }
}
