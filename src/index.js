import { EmissionsScraper } from './scraper.js';

async function main() {
  const scraper = new EmissionsScraper();

  try {
    await scraper.run();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
