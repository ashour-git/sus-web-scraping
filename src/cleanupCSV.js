import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import fs from 'fs/promises';
import path from 'path';

/**
 * Professional CSV Cleanup Utility
 * Cleans, deduplicates, and validates emissions data
 */

async function cleanupCSV() {
  console.log('🧹 PROFESSIONAL CSV CLEANUP & VALIDATION\n');
  console.log('='.repeat(80));

  const csvPath = './output/emissions_data.csv';
  const cleanedPath = './output/emissions_data_cleaned.csv';
  const reportPath = './output/cleanup_report.txt';

  try {
    // Read CSV
    const content = await fs.readFile(csvPath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    console.log(`📊 Original records: ${records.length}\n`);

    // Clean and validate records
    const cleanedRecords = [];
    const rejectedRecords = [];
    const stats = {
      total: records.length,
      valid: 0,
      rejected: 0,
      reasons: {}
    };

    for (const record of records) {
      const issues = validateRecord(record);

      if (issues.length === 0) {
        // Clean the record
        const cleaned = cleanRecord(record);
        cleanedRecords.push(cleaned);
        stats.valid++;
      } else {
        rejectedRecords.push({ record, issues });
        stats.rejected++;

        issues.forEach(issue => {
          stats.reasons[issue] = (stats.reasons[issue] || 0) + 1;
        });
      }
    }

    // Remove duplicates
    const uniqueRecords = deduplicateRecords(cleanedRecords);
    const duplicatesRemoved = cleanedRecords.length - uniqueRecords.length;

    // Sort by company, year, scope
    uniqueRecords.sort((a, b) => {
      if (a.Company !== b.Company) return a.Company.localeCompare(b.Company);
      if (a.Year !== b.Year) return parseInt(a.Year) - parseInt(b.Year);
      return a.Scope.localeCompare(b.Scope);
    });

    // Write cleaned CSV
    const csvContent = stringify(uniqueRecords, {
      header: true,
      columns: [
        'Company',
        'Year',
        'Scope',
        'Category',
        'Value',
        'Unit',
        'Source File',
        'Source Path',
        'Raw Text'
      ]
    });

    await fs.writeFile(cleanedPath, csvContent);

    // Generate report
    const report = generateReport(stats, duplicatesRemoved, uniqueRecords, rejectedRecords);
    await fs.writeFile(reportPath, report);

    // Display summary
    console.log('✅ CLEANUP COMPLETED!\n');
    console.log('='.repeat(80));
    console.log('SUMMARY:');
    console.log('='.repeat(80));
    console.log(`  📥 Original records: ${stats.total}`);
    console.log(`  ✅ Valid records: ${stats.valid}`);
    console.log(`  🔄 Duplicates removed: ${duplicatesRemoved}`);
    console.log(`  📊 Final records: ${uniqueRecords.length}`);
    console.log(`  ❌ Rejected records: ${stats.rejected}`);
    console.log('='.repeat(80));

    if (stats.rejected > 0) {
      console.log('\n⚠️  REJECTION REASONS:');
      console.log('-'.repeat(80));
      Object.entries(stats.reasons)
        .sort((a, b) => b[1] - a[1])
        .forEach(([reason, count]) => {
          console.log(`  • ${reason}: ${count} records`);
        });
      console.log('-'.repeat(80));
    }

    console.log(`\n📄 Cleaned CSV: ${cleanedPath}`);
    console.log(`📋 Full report: ${reportPath}\n`);

    // Analyze by company
    analyzeByCompany(uniqueRecords);

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    throw error;
  }
}

function validateRecord(record) {
  const issues = [];

  // Check for missing critical data
  if (!record.Company || record.Company === 'Unknown') {
    issues.push('Missing company name');
  }

  // Check for invalid year
  const year = parseInt(record.Year);
  if (record.Year === 'Unknown' || isNaN(year) || year < 2000 || year > 2025) {
    issues.push('Invalid year');
  }

  // Check for invalid value
  const value = parseFloat(record.Value);
  if (record.Value === 'Unknown' || isNaN(value) || value < 0) {
    issues.push('Invalid emission value');
  }

  // Check for extremely large/suspicious values (likely parsing errors)
  if (value > 1000000000) {
    issues.push('Suspiciously large value (likely parsing error)');
  }

  // Check for missing scope
  if (!record.Scope || record.Scope === 'Unknown') {
    issues.push('Missing scope information');
  }

  // Check for missing unit
  if (!record.Unit || record.Unit === 'Unknown') {
    issues.push('Missing unit');
  }

  // Check for very short raw text (likely parsing error)
  if (record['Raw Text'] && record['Raw Text'].length < 10) {
    issues.push('Insufficient raw text data');
  }

  return issues;
}

function cleanRecord(record) {
  return {
    'Company': record.Company.trim(),
    'Year': record.Year,
    'Scope': record.Scope,
    'Category': record.Category || 'General',
    'Value': parseFloat(record.Value).toFixed(2),
    'Unit': record.Unit,
    'Source File': path.basename(record['Source File']),
    'Source Path': record['Source Path'],
    'Raw Text': record['Raw Text'].substring(0, 500) // Limit raw text length
  };
}

function deduplicateRecords(records) {
  const seen = new Set();
  const unique = [];

  for (const record of records) {
    const key = `${record.Company}|${record.Year}|${record.Scope}|${record.Category}|${record.Value}|${record.Unit}`;

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(record);
    }
  }

  return unique;
}

function analyzeByCompany(records) {
  console.log('\n📊 ANALYSIS BY COMPANY:\n');
  console.log('='.repeat(80));

  const companies = {};

  records.forEach(record => {
    if (!companies[record.Company]) {
      companies[record.Company] = {
        count: 0,
        scopes: new Set(),
        years: new Set(),
        sources: new Set()
      };
    }

    companies[record.Company].count++;
    companies[record.Company].scopes.add(record.Scope);
    companies[record.Company].years.add(record.Year);
    companies[record.Company].sources.add(record['Source File']);
  });

  const sorted = Object.entries(companies)
    .sort((a, b) => b[1].count - a[1].count);

  sorted.forEach(([company, data], i) => {
    console.log(`${i + 1}. ${company}`);
    console.log(`   Records: ${data.count} | Years: ${[...data.years].sort().join(', ')} | Scopes: ${[...data.scopes].join(', ')}`);
    console.log(`   Sources: ${data.sources.size} file(s)`);
  });

  console.log('='.repeat(80) + '\n');
}

function generateReport(stats, duplicatesRemoved, uniqueRecords, rejectedRecords) {
  let report = '';

  report += '='.repeat(80) + '\n';
  report += 'PROFESSIONAL CSV CLEANUP REPORT\n';
  report += 'Generated: ' + new Date().toISOString() + '\n';
  report += '='.repeat(80) + '\n\n';

  report += 'SUMMARY STATISTICS:\n';
  report += '-'.repeat(80) + '\n';
  report += `Original records: ${stats.total}\n`;
  report += `Valid records: ${stats.valid}\n`;
  report += `Duplicates removed: ${duplicatesRemoved}\n`;
  report += `Final unique records: ${uniqueRecords.length}\n`;
  report += `Rejected records: ${stats.rejected}\n`;
  report += `Data quality: ${((stats.valid / stats.total) * 100).toFixed(1)}%\n`;
  report += '-'.repeat(80) + '\n\n';

  if (stats.rejected > 0) {
    report += 'REJECTION REASONS:\n';
    report += '-'.repeat(80) + '\n';
    Object.entries(stats.reasons)
      .sort((a, b) => b[1] - a[1])
      .forEach(([reason, count]) => {
        report += `${reason}: ${count} records (${((count / stats.total) * 100).toFixed(1)}%)\n`;
      });
    report += '-'.repeat(80) + '\n\n';
  }

  report += 'SAMPLE REJECTED RECORDS (First 10):\n';
  report += '-'.repeat(80) + '\n';
  rejectedRecords.slice(0, 10).forEach((item, i) => {
    report += `${i + 1}. Company: ${item.record.Company}, Year: ${item.record.Year}, Value: ${item.record.Value}\n`;
    report += `   Issues: ${item.issues.join(', ')}\n`;
  });
  report += '-'.repeat(80) + '\n';

  return report;
}

// Run cleanup
cleanupCSV().catch(console.error);
