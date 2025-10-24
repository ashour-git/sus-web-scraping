import fs from 'fs/promises';
import path from 'path';
import { config } from './config.js';

export class PDFDownloader {
  constructor(browserManager) {
    this.browserManager = browserManager;
    this.downloadedFiles = [];
    this.visitedUrls = new Set();
    this.downloadAttempts = new Map();
  }

  async ensureDownloadDir() {
    try {
      await fs.access(config.pdfOutputDir);
    } catch {
      await fs.mkdir(config.pdfOutputDir, { recursive: true });
    }
  }

  async findPDFLinks(page, url) {
    console.log(`  Navigating to ${url}...`);

    try {
      // Advanced navigation with stealth
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      });

      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 90000
      });

      // Wait for dynamic content
      await page.waitForTimeout(5000);

      // Advanced scroll simulation - human-like behavior
      await this.humanLikeScroll(page);

      // Wait for any lazy-loaded content
      await page.waitForTimeout(3000);

      // Try to dismiss popups/cookies/modals
      await this.dismissModals(page);

      // Try to click "Load More" or "Show All" buttons multiple times
      await this.clickLoadMoreButtons(page);

      // Take multiple approaches to find PDFs
      const pdfLinks = await this.comprehensivePDFSearch(page, url);

      return pdfLinks;
    } catch (error) {
      console.error(`  Error finding PDF links: ${error.message}`);
      return [];
    }
  }

  async humanLikeScroll(page) {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = Math.floor(Math.random() * 150) + 100; // Random scroll distance
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          // Random small pauses
          if (Math.random() > 0.7) {
            setTimeout(() => {}, Math.random() * 500);
          }

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            // Scroll back to top
            window.scrollTo(0, 0);
            setTimeout(resolve, 1000);
          }
        }, Math.random() * 200 + 100);
      });
    });
  }

  async dismissModals(page) {
    const modalSelectors = [
      'button:has-text("Accept")',
      'button:has-text("Accept All")',
      'button:has-text("I Accept")',
      'button:has-text("Got it")',
      'button:has-text("OK")',
      'button:has-text("Close")',
      'button:has-text("Agree")',
      'button[aria-label*="close"]',
      'button[aria-label*="Close"]',
      'button[class*="close"]',
      'button[class*="dismiss"]',
      '[class*="cookie"] button',
      '[class*="modal"] button',
      '[id*="cookie"] button',
      '.modal-close',
      '.close-button',
      '[data-dismiss="modal"]'
    ];

    for (const selector of modalSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await element.click({ timeout: 2000 });
          await page.waitForTimeout(500);
        }
      } catch (e) {
        // Continue to next selector
      }
    }
  }

  async comprehensivePDFSearch(page, baseUrl) {
    const pdfLinks = await page.evaluate((base) => {
      const links = new Set();

      // Helper to normalize URLs
      const normalizeUrl = (url) => {
        try {
          if (!url) return null;
          if (url.startsWith('//')) url = 'https:' + url;
          if (url.startsWith('/')) url = new URL(url, base).href;
          if (!url.startsWith('http')) url = new URL(url, base).href;
          return url;
        } catch {
          return null;
        }
      };

      // 1. Find all anchor tags with PDF-related attributes
      const anchors = document.querySelectorAll('a');
      anchors.forEach(anchor => {
        const href = normalizeUrl(anchor.href);
        if (!href) return;

        const text = anchor.textContent.toLowerCase();
        const ariaLabel = (anchor.getAttribute('aria-label') || '').toLowerCase();
        const title = (anchor.getAttribute('title') || '').toLowerCase();
        const className = (anchor.className || '').toLowerCase();

        const combinedText = `${text} ${ariaLabel} ${title} ${className}`;

        // Check if it's a PDF link
        const isPDFUrl = href.toLowerCase().includes('.pdf');
        const hasPDFKeywords = combinedText.includes('pdf') ||
                              combinedText.includes('download') ||
                              combinedText.includes('sustainability') ||
                              combinedText.includes('esg') ||
                              combinedText.includes('report') ||
                              combinedText.includes('emissions') ||
                              combinedText.includes('carbon') ||
                              combinedText.includes('environmental') ||
                              combinedText.includes('annual') ||
                              combinedText.includes('climate') ||
                              combinedText.includes('greenhouse') ||
                              combinedText.includes('disclosure');

        if (isPDFUrl || hasPDFKeywords) {
          links.add(JSON.stringify({
            url: href,
            text: anchor.textContent.trim() || anchor.getAttribute('title') || 'Untitled',
            type: 'anchor'
          }));
        }
      });

      // 2. Check for iframes with PDFs
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        const src = normalizeUrl(iframe.src);
        if (src && src.toLowerCase().includes('.pdf')) {
          links.add(JSON.stringify({
            url: src,
            text: 'Embedded PDF (iframe)',
            type: 'iframe'
          }));
        }
      });

      // 3. Check for object/embed tags
      const objects = document.querySelectorAll('object, embed');
      objects.forEach(obj => {
        const src = normalizeUrl(obj.getAttribute('data') || obj.getAttribute('src'));
        if (src && src.toLowerCase().includes('.pdf')) {
          links.add(JSON.stringify({
            url: src,
            text: 'Embedded PDF (object)',
            type: 'object'
          }));
        }
      });

      // 4. Check for buttons/divs with data attributes containing PDF URLs
      const dataElements = document.querySelectorAll('[data-url], [data-href], [data-link], [data-file], [data-pdf]');
      dataElements.forEach(elem => {
        const dataUrl = normalizeUrl(
          elem.getAttribute('data-url') ||
          elem.getAttribute('data-href') ||
          elem.getAttribute('data-link') ||
          elem.getAttribute('data-file') ||
          elem.getAttribute('data-pdf')
        );
        if (dataUrl && dataUrl.toLowerCase().includes('.pdf')) {
          links.add(JSON.stringify({
            url: dataUrl,
            text: elem.textContent.trim() || 'Data attribute PDF',
            type: 'data-attribute'
          }));
        }
      });

      // 5. Check script tags for PDF URLs
      const scripts = document.querySelectorAll('script');
      scripts.forEach(script => {
        const content = script.textContent;
        const pdfMatches = content.match(/https?:\/\/[^\s"']+\.pdf/gi);
        if (pdfMatches) {
          pdfMatches.forEach(match => {
            links.add(JSON.stringify({
              url: match,
              text: 'PDF from script',
              type: 'script'
            }));
          });
        }
      });

      return Array.from(links).map(item => JSON.parse(item));
    }, baseUrl);

    // Deduplicate by URL
    const uniqueLinks = Array.from(
      new Map(pdfLinks.map(link => [link.url, link])).values()
    );

    return uniqueLinks;
  }

  async clickLoadMoreButtons(page) {
    const loadMoreSelectors = [
      'button:has-text("Load More")',
      'button:has-text("Show More")',
      'button:has-text("View All")',
      'button:has-text("See All")',
      'button:has-text("Load All")',
      'a:has-text("Load More")',
      'a:has-text("Show More")',
      'a:has-text("View All")',
      'a:has-text("See All")',
      '[class*="load-more"]',
      '[class*="show-more"]',
      '[class*="view-all"]',
      '[class*="see-all"]',
      '[id*="load-more"]',
      '[id*="show-more"]',
      '[id*="view-all"]',
      'button[aria-label*="more"]',
      'button[aria-label*="More"]'
    ];

    // Try clicking multiple times as content may load in batches
    for (let attempt = 0; attempt < 5; attempt++) {
      let clicked = false;

      for (const selector of loadMoreSelectors) {
        try {
          const elements = await page.$$(selector);
          for (const element of elements) {
            const isVisible = await element.isVisible();
            if (isVisible) {
              await element.click({ timeout: 3000 });
              clicked = true;
              console.log(`  ✓ Clicked "${selector}" button (attempt ${attempt + 1})`);
              await page.waitForTimeout(3000); // Wait for content to load
            }
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      if (!clicked) break; // No more buttons to click
    }
  }

  async downloadPDF(page, pdfUrl, sourcePage, linkText = '') {
    // Skip if already visited
    if (this.visitedUrls.has(pdfUrl)) {
      console.log(`  ⏭️  Skipped (already processed): ${linkText || pdfUrl}`);
      return null;
    }

    this.visitedUrls.add(pdfUrl);
    await this.ensureDownloadDir();

    const filename = this.generateFilename(pdfUrl, linkText);
    const filepath = path.join(config.pdfOutputDir, filename);

    // Check if file already exists
    try {
      const stats = await fs.stat(filepath);
      if (stats.size > 1000) { // Only skip if file is substantial
        console.log(`  ⏭️  Skipped (already exists): ${filename}`);
        this.downloadedFiles.push({
          filename,
          filepath,
          sourceUrl: pdfUrl,
          sourcePage
        });
        return filepath;
      }
    } catch {
      // File doesn't exist, proceed with download
    }

    console.log(`  📥 Downloading: ${linkText || pdfUrl}`);

    // Track attempts
    const attemptKey = pdfUrl;
    const attempts = this.downloadAttempts.get(attemptKey) || 0;
    if (attempts >= 3) {
      console.log(`  ⚠️  Skipped (max attempts reached): ${filename}`);
      return null;
    }
    this.downloadAttempts.set(attemptKey, attempts + 1);

    try {
      // Method 1: Direct API request with proper headers
      try {
        const response = await page.context().request.get(pdfUrl, {
          timeout: config.downloadTimeout,
          headers: {
            'Referer': sourcePage,
            'Accept': 'application/pdf,application/octet-stream,*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          maxRedirects: 5
        });

        if (response.ok()) {
          const buffer = await response.body();

          // Verify it's actually a PDF
          const isPDF = buffer.length > 4 &&
                       buffer[0] === 0x25 && buffer[1] === 0x50 &&
                       buffer[2] === 0x44 && buffer[3] === 0x46; // %PDF

          if (isPDF && buffer.length > 1000) {
            await fs.writeFile(filepath, buffer);

            this.downloadedFiles.push({
              filename,
              filepath,
              sourceUrl: pdfUrl,
              sourcePage,
              linkText
            });

            console.log(`  ✓ Downloaded: ${filename} (${(buffer.length / 1024).toFixed(2)} KB)`);
            return filepath;
          } else if (buffer.length > 1000) {
            // Might be a PDF despite header check failure
            await fs.writeFile(filepath, buffer);
            console.log(`  ⚠️  Downloaded (unverified): ${filename} (${(buffer.length / 1024).toFixed(2)} KB)`);
            this.downloadedFiles.push({
              filename,
              filepath,
              sourceUrl: pdfUrl,
              sourcePage,
              linkText
            });
            return filepath;
          }
        }
      } catch (requestError) {
        console.log(`  ⚠️  Method 1 failed: ${requestError.message}`);
      }

      // Method 2: Browser navigation with download interception
      try {
        const newPage = await page.context().newPage();

        try {
          // Set up download handler
          const downloadPromise = newPage.waitForEvent('download', {
            timeout: config.downloadTimeout
          }).catch(() => null);

          // Navigate to PDF
          await newPage.goto(pdfUrl, {
            waitUntil: 'domcontentloaded',
            timeout: config.downloadTimeout
          });

          // Wait for download event
          const download = await downloadPromise;

          if (download) {
            await download.saveAs(filepath);

            const stats = await fs.stat(filepath);
            this.downloadedFiles.push({
              filename,
              filepath,
              sourceUrl: pdfUrl,
              sourcePage,
              linkText
            });

            console.log(`  ✓ Downloaded: ${filename} (${(stats.size / 1024).toFixed(2)} KB)`);
            await newPage.close();
            return filepath;
          }

          // If no download event, try to get content directly
          await newPage.waitForTimeout(2000);
          const content = await newPage.content();

          if (content.includes('%PDF') || content.includes('application/pdf')) {
            try {
              const cdpSession = await newPage.context().newCDPSession(newPage);
              const { data } = await cdpSession.send('Page.printToPDF', {
                printBackground: true
              });

              const buffer = Buffer.from(data, 'base64');
              await fs.writeFile(filepath, buffer);

              console.log(`  ✓ Downloaded (CDP): ${filename}`);
              this.downloadedFiles.push({
                filename,
                filepath,
                sourceUrl: pdfUrl,
                sourcePage,
                linkText
              });

              await newPage.close();
              return filepath;
            } catch (cdpError) {
              console.log(`  ⚠️  CDP method failed: ${cdpError.message}`);
            }
          }

        } finally {
          if (!newPage.isClosed()) {
            await newPage.close();
          }
        }
      } catch (browserError) {
        console.log(`  ⚠️  Method 2 failed: ${browserError.message}`);
      }

      // Method 3: Click on the link from the original page
      try {
        const linkSelector = `a[href="${pdfUrl}"], a[href*="${path.basename(pdfUrl)}"]`;
        const link = await page.$(linkSelector);

        if (link) {
          const downloadPromise = page.waitForEvent('download', {
            timeout: config.downloadTimeout
          }).catch(() => null);

          await link.click();

          const download = await downloadPromise;
          if (download) {
            await download.saveAs(filepath);

            const stats = await fs.stat(filepath);
            this.downloadedFiles.push({
              filename,
              filepath,
              sourceUrl: pdfUrl,
              sourcePage,
              linkText
            });

            console.log(`  ✓ Downloaded (click): ${filename} (${(stats.size / 1024).toFixed(2)} KB)`);
            return filepath;
          }
        }
      } catch (clickError) {
        console.log(`  ⚠️  Method 3 failed: ${clickError.message}`);
      }

      console.error(`  ✗ Failed: ${filename} - All methods exhausted`);
      return null;

    } catch (error) {
      console.error(`  ✗ Error downloading ${filename}: ${error.message}`);
      return null;
    }
  }

  generateFilename(url, linkText = '') {
    try {
      const urlParts = new URL(url);
      let filename = path.basename(urlParts.pathname);

      // Clean up filename
      filename = decodeURIComponent(filename);
      filename = filename.replace(/[^a-z0-9._-]/gi, '_');

      if (!filename.endsWith('.pdf') || filename.length < 5) {
        const domain = urlParts.hostname.replace('www.', '').split('.')[0];
        const cleanText = linkText.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
        filename = `${domain}_${cleanText}_${Date.now()}.pdf`;
      }

      // Ensure filename isn't too long
      if (filename.length > 200) {
        const ext = path.extname(filename);
        const name = path.basename(filename, ext);
        filename = name.substring(0, 190) + ext;
      }

      return filename;
    } catch (error) {
      return `document_${Date.now()}.pdf`;
    }
  }

  async downloadFromUrls(urls) {
    const page = await this.browserManager.newPage();

    for (const url of urls) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🔍 Scanning: ${url}`);
      console.log(`${'='.repeat(80)}`);

      try {
        // Check if URL is direct PDF
        if (url.toLowerCase().endsWith('.pdf')) {
          console.log(`  Direct PDF link detected`);
          await this.downloadPDF(page, url, url, 'Direct PDF');
          continue;
        }

        const pdfLinks = await this.findPDFLinks(page, url);
        console.log(`  Found ${pdfLinks.length} potential PDF links\n`);

        if (pdfLinks.length === 0) {
          console.log(`  ⚠️  No PDF links found on this page`);
          continue;
        }

        // Remove duplicates
        const uniqueLinks = Array.from(
          new Map(pdfLinks.map(link => [link.url, link])).values()
        );

        console.log(`  Downloading ${uniqueLinks.length} unique PDFs...\n`);

        for (let i = 0; i < uniqueLinks.length; i++) {
          const link = uniqueLinks[i];
          console.log(`  [${i + 1}/${uniqueLinks.length}] ${link.text}`);
          await this.downloadPDF(page, link.url, url, link.text);

          // Add delay between downloads to avoid rate limiting
          if (i < uniqueLinks.length - 1) {
            await page.waitForTimeout(2000);
          }
        }

        console.log(`\n  ✅ Completed scanning ${url}`);

      } catch (error) {
        console.error(`\n  ❌ Error processing ${url}: ${error.message}`);
      }

      // Delay between different websites
      await page.waitForTimeout(3000);
    }

    await page.close();

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 Download Summary`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Total PDFs downloaded: ${this.downloadedFiles.length}`);
    console.log(`${'='.repeat(80)}\n`);

    return this.downloadedFiles;
  }
}
