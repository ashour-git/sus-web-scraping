import fs from 'fs/promises';
import path from 'path';

/**
 * Advanced PDF Validator - Ensures only real PDFs are saved
 */
export class PDFValidator {
  constructor(config) {
    this.config = config;
  }

  /**
   * Validate if buffer is a real PDF
   */
  async validateBuffer(buffer) {
    const checks = {
      sizeCheck: false,
      magicBytesCheck: false,
      structureCheck: false,
      contentCheck: false
    };

    // 1. Size Check
    if (buffer.length >= this.config.minSize && buffer.length <= this.config.maxSize) {
      checks.sizeCheck = true;
    }

    // 2. Magic Bytes Check - PDF signature
    if (this.config.checkMagicBytes) {
      const header = buffer.slice(0, 5).toString('ascii');
      if (header === '%PDF-') {
        checks.magicBytesCheck = true;
      }
    }

    // 3. Structure Check - Look for PDF trailer
    if (this.config.requireValidStructure) {
      const content = buffer.toString('ascii', Math.max(0, buffer.length - 1024));
      if (content.includes('%%EOF') || content.includes('endobj')) {
        checks.structureCheck = true;
      }
    }

    // 4. Content Check - Not HTML/XML
    const preview = buffer.slice(0, 500).toString('utf-8').toLowerCase();
    const isHTML = preview.includes('<!doctype html') ||
                   preview.includes('<html') ||
                   preview.includes('<head>') ||
                   preview.includes('<?xml');

    const isErrorPage = preview.includes('error') && preview.includes('<') ||
                        preview.includes('403') || preview.includes('404') ||
                        preview.includes('not found') && preview.includes('<');

    if (!isHTML && !isErrorPage) {
      checks.contentCheck = true;
    }

    // Calculate score
    const score = Object.values(checks).filter(v => v).length;
    const maxScore = Object.keys(checks).length;

    return {
      valid: score >= 3, // At least 3 out of 4 checks must pass
      score,
      maxScore,
      checks,
      reason: this.getValidationReason(checks)
    };
  }

  /**
   * Validate existing file
   */
  async validateFile(filepath) {
    try {
      const buffer = await fs.readFile(filepath);
      return await this.validateBuffer(buffer);
    } catch (error) {
      return {
        valid: false,
        score: 0,
        maxScore: 4,
        checks: {},
        reason: `File read error: ${error.message}`
      };
    }
  }

  /**
   * Get human-readable validation reason
   */
  getValidationReason(checks) {
    const failed = [];

    if (!checks.sizeCheck) failed.push('invalid size');
    if (!checks.magicBytesCheck) failed.push('missing PDF header');
    if (!checks.structureCheck) failed.push('invalid PDF structure');
    if (!checks.contentCheck) failed.push('appears to be HTML/error page');

    if (failed.length === 0) return 'Valid PDF';
    return `Failed checks: ${failed.join(', ')}`;
  }

  /**
   * Scan directory and identify fake PDFs
   */
  async scanDirectory(directory) {
    const files = await fs.readdir(directory);
    const pdfFiles = files.filter(f => f.endsWith('.pdf'));

    const results = {
      total: pdfFiles.length,
      valid: [],
      invalid: [],
      errors: []
    };

    for (const file of pdfFiles) {
      const filepath = path.join(directory, file);
      const validation = await this.validateFile(filepath);

      if (validation.valid) {
        results.valid.push({ file, filepath, validation });
      } else {
        results.invalid.push({ file, filepath, validation });
      }
    }

    return results;
  }

  /**
   * Remove fake PDF files
   */
  async cleanupFakePDFs(directory, dryRun = false) {
    const scanResults = await this.scanDirectory(directory);

    console.log('\n🧹 PDF CLEANUP REPORT');
    console.log('='.repeat(80));
    console.log(`Total PDFs: ${scanResults.total}`);
    console.log(`Valid PDFs: ${scanResults.valid.length}`);
    console.log(`Fake PDFs: ${scanResults.invalid.length}`);

    if (scanResults.invalid.length === 0) {
      console.log('\n✅ No fake PDFs found!');
      return scanResults;
    }

    console.log('\n❌ Fake PDFs to remove:');
    for (const item of scanResults.invalid) {
      const stats = await fs.stat(item.filepath);
      const sizeMB = (stats.size / 1024).toFixed(2);
      console.log(`  • ${item.file} (${sizeMB} KB) - ${item.validation.reason}`);
    }

    if (dryRun) {
      console.log('\n⚠️  DRY RUN - No files were deleted');
      return scanResults;
    }

    // Delete fake PDFs
    console.log('\n🗑️  Deleting fake PDFs...');
    let deleted = 0;
    for (const item of scanResults.invalid) {
      try {
        await fs.unlink(item.filepath);
        deleted++;
        console.log(`  ✓ Deleted: ${item.file}`);
      } catch (error) {
        console.error(`  ✗ Failed to delete ${item.file}: ${error.message}`);
      }
    }

    console.log(`\n✅ Cleanup complete: ${deleted} files deleted`);
    return scanResults;
  }
}
