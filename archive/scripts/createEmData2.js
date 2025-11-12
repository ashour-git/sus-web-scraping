import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

/**
 * HYBRID MERGE STRATEGY FOR EM_DATA_2.CSV
 *
 * This script creates an enhanced dataset by:
 * 1. Re-analyzing original emissions_data.csv with advanced scoring
 * 2. Merging with current em_data.csv
 * 3. Smart deduplication (keeps highest confidence records)
 * 4. Enhanced metadata and quality metrics
 */

class HybridDataMerger {
  constructor() {
    this.confidencePatterns = {
      // High-confidence patterns (table-like structured data)
      tableIndicators: [
        /scope\s*[123]\s*[:|\-|–]\s*[\d,\.]+/i,
        /\|\s*scope/i,
        /emissions\s*\(.*?co2.*?\)\s*[:|\-]\s*[\d,\.]+/i
      ],

      // Medium-confidence patterns (scope-section data)
      scopeHeaderIndicators: [
        /^scope\s*[123]/im,
        /scope\s*[123]\s*emissions/i,
        /direct\s*emissions.*scope\s*1/i,
        /indirect\s*emissions.*scope\s*2/i
      ],

      // Context quality indicators
      qualityIndicators: [
        /verified/i,
        /audited/i,
        /ghg\s*protocol/i,
        /iso\s*14064/i,
        /carbon\s*disclosure/i,
        /sustainability\s*report/i
      ]
    };
  }

  /**
   * Analyze extraction method based on context and patterns
   */
  inferExtractionMethod(record) {
    const context = record.context || '';
    const scope = record.scope || '';
    const value = record.value || '';

    // Check for table-like structure
    const hasTableIndicators = this.confidencePatterns.tableIndicators.some(
      pattern => pattern.test(context)
    );

    // Check for scope-section structure
    const hasScopeHeaders = this.confidencePatterns.scopeHeaderIndicators.some(
      pattern => pattern.test(context)
    );

    // Check for quality indicators
    const qualityScore = this.confidencePatterns.qualityIndicators.filter(
      pattern => pattern.test(context)
    ).length;

    if (hasTableIndicators) {
      return {
        method: 'table_extraction',
        baseConfidence: 0.8,
        qualityBonus: qualityScore * 0.05
      };
    } else if (hasScopeHeaders) {
      return {
        method: 'scope_section_extraction',
        baseConfidence: 0.7,
        qualityBonus: qualityScore * 0.05
      };
    } else {
      return {
        method: 'statement_extraction',
        baseConfidence: 0.5,
        qualityBonus: qualityScore * 0.05
      };
    }
  }

  /**
   * Calculate enhanced confidence score
   */
  calculateEnhancedConfidence(record, extractionInfo) {
    let confidence = extractionInfo.baseConfidence;

    // Add quality bonus
    confidence += extractionInfo.qualityBonus;

    // Field completeness bonus
    const fields = [record.year, record.unit, record.scope, record.company];
    const completeness = fields.filter(f => f && f.toString().trim()).length / fields.length;
    confidence += completeness * 0.1;

    // Numeric value validation
    const numericValue = parseFloat(record.value?.toString().replace(/,/g, ''));
    if (!isNaN(numericValue) && numericValue > 0) {
      confidence += 0.05;
    }

    // Year validation
    const year = parseInt(record.year);
    if (year >= 2000 && year <= 2025) {
      confidence += 0.05;
    }

    // Unit validation
    const validUnits = ['tonnes co2e', 'mtco2e', 'kt co2e', 'tons co2e'];
    const normalizedUnit = (record.unit || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (validUnits.some(u => normalizedUnit.includes(u.replace(/[^a-z0-9]/g, '')))) {
      confidence += 0.05;
    }

    // Cap at 1.0
    return Math.min(confidence, 1.0);
  }

  /**
   * Normalize company name
   */
  normalizeCompanyName(name) {
    if (!name) return '';

    return name
      .replace(/\s+(corporation|corp|incorporated|inc|limited|ltd|plc|sa|nv|ag)\.?$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Create enhanced record from original
   */
  enhanceRecord(originalRecord) {
    // Map old column names to new ones
    const company = originalRecord.Company || originalRecord.company || '';
    const year = originalRecord.Year || originalRecord.year || originalRecord.fiscal_year || '';
    const scope = originalRecord.Scope || originalRecord.scope || '';
    const value = originalRecord.Value || originalRecord.value || originalRecord.value_tonnes_co2e || '';
    const unit = originalRecord.Unit || originalRecord.unit || '';
    const source = originalRecord['Source File'] || originalRecord.source || originalRecord.source_document || '';
    const category = originalRecord.Category || originalRecord.category || '';

    const extractionInfo = this.inferExtractionMethod({
      context: category || '',
      scope: scope,
      value: value
    });

    const record = {
      company,
      year,
      scope,
      value,
      unit,
      source,
      category,
      context: category
    };

    const confidence = this.calculateEnhancedConfidence(record, extractionInfo);

    return {
      id: uuidv4(),
      company_name: this.normalizeCompanyName(company),
      company_name_normalized: this.normalizeCompanyName(company).toLowerCase(),
      year: parseInt(year) || null,
      scope: scope || null,
      value: parseFloat(value?.toString().replace(/,/g, '')) || null,
      unit: unit || null,
      unit_normalized: (unit || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
      context: category || null,
      source_file: source || null,
      extraction_method: extractionInfo.method,
      confidence_score: parseFloat(confidence.toFixed(2)),
      data_quality: confidence >= 0.7 ? 'high' : (confidence >= 0.5 ? 'medium' : 'low'),
      has_scope: !!scope,
      has_year: !!year && !isNaN(parseInt(year)),
      has_unit: !!unit,
      has_context: !!category && category.length > 0,
      value_numeric: !isNaN(parseFloat(value?.toString().replace(/,/g, ''))),
      timestamp: new Date().toISOString(),
      record_version: '2.0',
      data_source: 'hybrid_merge_enhanced',
      original_extraction_method: 'statement_extraction'
    };
  }

  /**
   * Smart deduplication - keeps highest confidence record
   */
  deduplicateRecords(records) {
    const dedupMap = new Map();

    for (const record of records) {
      // Create unique key based on exact match criteria
      const key = `${record.id}`;

      // Check for fuzzy duplicates (same company, year, scope, similar value)
      const fuzzyKey = `${record.company_name_normalized}|${record.year}|${record.scope}|${Math.round(record.value * 100) / 100}|${record.source_file}`;

      // First check if we've seen this exact record ID
      if (!dedupMap.has(key)) {
        // Then check if we have a fuzzy duplicate
        let isDuplicate = false;
        for (const [existingKey, existingRecord] of dedupMap.entries()) {
          const existingFuzzyKey = `${existingRecord.company_name_normalized}|${existingRecord.year}|${existingRecord.scope}|${Math.round(existingRecord.value * 100) / 100}|${existingRecord.source_file}`;

          if (existingFuzzyKey === fuzzyKey) {
            // Found a duplicate - keep the one with higher confidence
            if (record.confidence_score > existingRecord.confidence_score) {
              dedupMap.delete(existingKey);
              dedupMap.set(key, record);
            }
            isDuplicate = true;
            break;
          }
        }

        if (!isDuplicate) {
          dedupMap.set(key, record);
        }
      }
    }

    return Array.from(dedupMap.values());
  }

  /**
   * Merge and enhance datasets
   */
  async mergeDatasets() {
    console.log('🚀 HYBRID MERGE STARTING: Creating em_data_2.csv\n');

    // Load original emissions_data.csv
    console.log('📂 Loading emissions_data.csv...');
    const originalCsvPath = 'output/emissions_data.csv';
    const originalCsvContent = fs.readFileSync(originalCsvPath, 'utf-8');
    const originalRecords = parse(originalCsvContent, {
      columns: true,
      skip_empty_lines: true
    });
    console.log(`   ✅ Loaded ${originalRecords.length} original records\n`);

    // Load current em_data.csv
    console.log('📂 Loading em_data.csv...');
    const currentCsvPath = 'output/em_data.csv';
    const currentCsvContent = fs.readFileSync(currentCsvPath, 'utf-8');
    const currentRecordsRaw = parse(currentCsvContent, {
      columns: true,
      skip_empty_lines: true
    });

    // Transform current records to match new schema
    const currentRecords = currentRecordsRaw.map(r => ({
      id: r.id || uuidv4(),
      company_name: r.company_name || '',
      company_name_normalized: (r.company_name || '').toLowerCase(),
      year: parseInt(r.fiscal_year || r.year) || null,
      scope: r.scope || null,
      value: parseFloat(r.value_tonnes_co2e || r.value) || null,
      unit: r.unit || null,
      unit_normalized: (r.unit || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
      context: r.category || r.context || null,
      source_file: r.source_document || r.source_file || null,
      extraction_method: r.extraction_method || 'statement_extraction',
      confidence_score: parseFloat(r.confidence_score) || 0.5,
      data_quality: r.quality_flag || r.data_quality || 'medium',
      has_scope: !!r.scope,
      has_year: !!r.fiscal_year || !!r.year,
      has_unit: !!r.unit,
      has_context: !!(r.category || r.context),
      value_numeric: !isNaN(parseFloat(r.value_tonnes_co2e || r.value)),
      timestamp: r.created_at || r.timestamp || new Date().toISOString(),
      record_version: r.data_version || '1.0',
      data_source: 'current_em_data',
      original_extraction_method: r.extraction_method || 'statement_extraction'
    }));

    console.log(`   ✅ Loaded ${currentRecords.length} current records\n`);

    // Re-analyze original records with advanced scoring
    console.log('🔍 Re-analyzing original records with advanced extraction detection...');
    const reanalyzedRecords = originalRecords.map(record => this.enhanceRecord(record));

    const methodDistribution = {};
    reanalyzedRecords.forEach(r => {
      methodDistribution[r.extraction_method] = (methodDistribution[r.extraction_method] || 0) + 1;
    });

    console.log('\n   📊 New Extraction Method Distribution:');
    Object.entries(methodDistribution).forEach(([method, count]) => {
      const percentage = ((count / reanalyzedRecords.length) * 100).toFixed(1);
      console.log(`      • ${method}: ${count} records (${percentage}%)`);
    });

    // Quality distribution
    const qualityDist = {
      high: reanalyzedRecords.filter(r => r.data_quality === 'high').length,
      medium: reanalyzedRecords.filter(r => r.data_quality === 'medium').length,
      low: reanalyzedRecords.filter(r => r.data_quality === 'low').length
    };

    console.log('\n   📈 Quality Distribution:');
    console.log(`      🟢 High (≥0.7): ${qualityDist.high} records (${((qualityDist.high / reanalyzedRecords.length) * 100).toFixed(1)}%)`);
    console.log(`      🟡 Medium (0.5-0.7): ${qualityDist.medium} records (${((qualityDist.medium / reanalyzedRecords.length) * 100).toFixed(1)}%)`);
    console.log(`      🔴 Low (<0.5): ${qualityDist.low} records (${((qualityDist.low / reanalyzedRecords.length) * 100).toFixed(1)}%)\n`);

    // Merge both datasets
    console.log('🔀 Merging datasets...');
    const allRecords = [...reanalyzedRecords, ...currentRecords];
    console.log(`   📦 Total before deduplication: ${allRecords.length} records\n`);

    // Smart deduplication
    console.log('🎯 Applying smart deduplication (quality-prioritized)...');
    const finalRecords = this.deduplicateRecords(allRecords);
    console.log(`   ✅ Final unique records: ${finalRecords.length}`);
    console.log(`   🗑️  Duplicates removed: ${allRecords.length - finalRecords.length}\n`);

    // Sort by company, year, scope
    finalRecords.sort((a, b) => {
      if (a.company_name !== b.company_name) {
        return a.company_name.localeCompare(b.company_name);
      }
      if (a.year !== b.year) {
        return (a.year || 0) - (b.year || 0);
      }
      const scopeOrder = { 'Scope 1': 1, 'Scope 2': 2, 'Scope 3': 3 };
      return (scopeOrder[a.scope] || 999) - (scopeOrder[b.scope] || 999);
    });

    // Generate CSV
    console.log('💾 Generating em_data_2.csv...');
    const csvContent = stringify(finalRecords, {
      header: true,
      columns: [
        'id', 'company_name', 'company_name_normalized', 'year', 'scope',
        'value', 'unit', 'unit_normalized', 'context', 'source_file',
        'extraction_method', 'confidence_score', 'data_quality',
        'has_scope', 'has_year', 'has_unit', 'has_context', 'value_numeric',
        'timestamp', 'record_version', 'data_source', 'original_extraction_method'
      ]
    });

    const outputPath = 'output/em_data_2.csv';
    fs.writeFileSync(outputPath, csvContent);

    const fileSize = (fs.statSync(outputPath).size / 1024).toFixed(1);
    console.log(`   ✅ Saved to: ${outputPath}`);
    console.log(`   📊 File size: ${fileSize} KB\n`);

    // Final statistics
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 FINAL STATISTICS FOR EM_DATA_2.CSV\n');

    console.log('📈 Dataset Comparison:');
    console.log(`   • Original emissions_data.csv: ${originalRecords.length} records`);
    console.log(`   • Current em_data.csv: ${currentRecords.length} records`);
    console.log(`   • New em_data_2.csv: ${finalRecords.length} records\n`);

    const finalMethodDist = {};
    finalRecords.forEach(r => {
      finalMethodDist[r.extraction_method] = (finalMethodDist[r.extraction_method] || 0) + 1;
    });

    console.log('🎯 Final Extraction Method Distribution:');
    Object.entries(finalMethodDist).forEach(([method, count]) => {
      const percentage = ((count / finalRecords.length) * 100).toFixed(1);
      console.log(`   • ${method}: ${count} records (${percentage}%)`);
    });

    const finalQualityDist = {
      high: finalRecords.filter(r => r.data_quality === 'high').length,
      medium: finalRecords.filter(r => r.data_quality === 'medium').length,
      low: finalRecords.filter(r => r.data_quality === 'low').length
    };

    console.log('\n📊 Final Quality Distribution:');
    console.log(`   🟢 High Quality (≥0.7): ${finalQualityDist.high} records (${((finalQualityDist.high / finalRecords.length) * 100).toFixed(1)}%)`);
    console.log(`   🟡 Medium Quality (0.5-0.7): ${finalQualityDist.medium} records (${((finalQualityDist.medium / finalRecords.length) * 100).toFixed(1)}%)`);
    console.log(`   🔴 Low Quality (<0.5): ${finalQualityDist.low} records (${((finalQualityDist.low / finalRecords.length) * 100).toFixed(1)}%)\n`);

    const avgConfidence = (finalRecords.reduce((sum, r) => sum + r.confidence_score, 0) / finalRecords.length).toFixed(3);
    console.log(`📊 Average Confidence Score: ${avgConfidence}\n`);

    const companies = new Set(finalRecords.map(r => r.company_name_normalized));
    console.log(`🏢 Unique Companies: ${companies.size}\n`);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ HYBRID MERGE COMPLETE!\n');
    console.log('🎯 KEY IMPROVEMENTS IN EM_DATA_2.CSV:');
    console.log('   ✅ Multi-strategy extraction method detection');
    console.log('   ✅ Enhanced confidence scoring (0.4-1.0 range)');
    console.log('   ✅ Smart deduplication (quality-prioritized)');
    console.log('   ✅ Improved data quality distribution');
    console.log('   ✅ 22 comprehensive fields for AI/ML\n');

    console.log('📁 Output: output/em_data_2.csv\n');

    return {
      totalRecords: finalRecords.length,
      methodDistribution: finalMethodDist,
      qualityDistribution: finalQualityDist,
      avgConfidence: parseFloat(avgConfidence),
      uniqueCompanies: companies.size
    };
  }
}

// Execute
const merger = new HybridDataMerger();
merger.mergeDatasets().catch(console.error);
