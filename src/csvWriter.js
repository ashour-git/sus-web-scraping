import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs/promises';
import path from 'path';
import { config } from './config.js';

export class CSVWriter {
  constructor(outputPath = null) {
    this.outputPath = outputPath || config.csvOutputPath;
  }

  async writeRecords(records) {
    const outputDir = path.dirname(this.outputPath);

    try {
      await fs.access(outputDir);
    } catch {
      await fs.mkdir(outputDir, { recursive: true });
    }

    const csvWriter = createObjectCsvWriter({
      path: this.outputPath,
      header: [
        { id: 'company', title: 'Company' },
        { id: 'year', title: 'Year' },
        { id: 'scope', title: 'Scope' },
        { id: 'category', title: 'Category' },
        { id: 'value', title: 'Value' },
        { id: 'unit', title: 'Unit' },
        { id: 'sourceFile', title: 'Source File' },
        { id: 'source', title: 'Source Path' },
        { id: 'rawText', title: 'Raw Text' },
        { id: 'confidence', title: 'Confidence' },
        { id: 'method', title: 'Extraction Method' }
      ]
    });

    await csvWriter.writeRecords(records);
    console.log(`\n✓ CSV file created: ${this.outputPath}`);
    console.log(`  Total records: ${records.length}`);
  }

  async appendRecords(csvPath, records) {
    if (records.length === 0) {
      console.log('No records to append.');
      return;
    }

    const outputDir = path.dirname(csvPath);

    try {
      await fs.access(outputDir);
    } catch {
      await fs.mkdir(outputDir, { recursive: true });
    }

    // Check if file exists
    let fileExists = false;
    try {
      await fs.access(csvPath);
      fileExists = true;
    } catch {}

    const csvWriter = createObjectCsvWriter({
      path: csvPath,
      header: [
        { id: 'company', title: 'Company' },
        { id: 'year', title: 'Year' },
        { id: 'scope', title: 'Scope' },
        { id: 'category', title: 'Category' },
        { id: 'value', title: 'Value' },
        { id: 'unit', title: 'Unit' },
        { id: 'sourceFile', title: 'Source File' },
        { id: 'source', title: 'Source Path' },
        { id: 'rawText', title: 'Raw Text' }
      ],
      append: fileExists // Append if file exists
    });

    await csvWriter.writeRecords(records);
    console.log(`✓ CSV ${fileExists ? 'updated' : 'created'}: ${csvPath}`);
    console.log(`  Records ${fileExists ? 'appended' : 'written'}: ${records.length}`);
  }
}
