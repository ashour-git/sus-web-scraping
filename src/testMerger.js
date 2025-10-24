// Quick test of merger
import fs from 'fs/promises';
import { parse } from 'csv-parse/sync';

async function testMerger() {
  console.log('Testing merger...');
  
  const ultrathinkPath = 'output/emissions_data.csv';
  
  try {
    const content = await fs.readFile(ultrathinkPath, 'utf-8');
    console.log('✅ File read successfully');
    console.log('Content length:', content.length);
    
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true
    });
    
    console.log('✅ Parsed records:', records.length);
    console.log('Sample record:', records[0]);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testMerger();
