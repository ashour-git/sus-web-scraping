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

    const records = [];
    const lines = text.split('\n');

    const emissionKeywords = [
      'scope 1', 'scope 2', 'scope 3',
      'co2', 'carbon', 'emissions', 'ghg',
      'greenhouse gas', 'metric tons', 'tonnes'
    ];

    const numberPattern = /[\d,]+\.?\d*/g;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();

      const hasEmissionKeyword = emissionKeywords.some(keyword =>
        line.includes(keyword)
      );

      if (hasEmissionKeyword) {
        const numbers = line.match(numberPattern);

        if (numbers && numbers.length > 0) {
          const year = this.extractYear(line);
          const scope = this.extractScope(line);
          const value = this.extractValue(numbers);

          records.push({
            source: pdfPath,
            year: year || 'Unknown',
            scope: scope || 'Unknown',
            category: this.extractCategory(line),
            value: value || 'Unknown',
            unit: this.extractUnit(line),
            rawText: lines[i].trim()
          });
        }
      }
    }

    return records;
  }

  extractYear(text) {
    const yearMatch = text.match(/\b(19|20)\d{2}\b/);
    return yearMatch ? yearMatch[0] : null;
  }

  extractScope(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('scope 1')) return 'Scope 1';
    if (lowerText.includes('scope 2')) return 'Scope 2';
    if (lowerText.includes('scope 3')) return 'Scope 3';
    return null;
  }

  extractCategory(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('direct')) return 'Direct Emissions';
    if (lowerText.includes('indirect')) return 'Indirect Emissions';
    if (lowerText.includes('energy')) return 'Energy';
    if (lowerText.includes('transport')) return 'Transportation';
    return 'General';
  }

  extractValue(numbers) {
    const cleaned = numbers.map(n => n.replace(/,/g, ''));
    const validNumbers = cleaned.filter(n => !isNaN(parseFloat(n)));

    if (validNumbers.length > 0) {
      return validNumbers[0];
    }
    return null;
  }

  extractUnit(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('mtco2e') || lowerText.includes('mt co2e')) {
      return 'MT CO2e';
    }
    if (lowerText.includes('tco2e') || lowerText.includes('tonnes co2e')) {
      return 'tonnes CO2e';
    }
    if (lowerText.includes('metric tons')) {
      return 'Metric Tons';
    }
    return 'Unknown';
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
