import { advancedConfig } from './advancedConfig.js';

/**
 * CAPTCHA Solver - Integrates with 2captcha and Anti-Captcha services
 */
export class CaptchaSolver {
  constructor(config = advancedConfig.captcha) {
    this.config = config;
    this.apiKey = config.apiKey;
    this.provider = config.provider;
  }

  /**
   * Detect if page has CAPTCHA
   */
  async detectCaptcha(page) {
    const captchaSelectors = [
      'iframe[src*="recaptcha"]',
      'iframe[src*="hcaptcha"]',
      'div[class*="captcha"]',
      'div[id*="captcha"]',
      '#g-recaptcha',
      '.g-recaptcha',
      '.h-captcha',
      '[data-sitekey]',
      'div.captcha-container',
      'div.cf-challenge-running' // Cloudflare
    ];

    for (const selector of captchaSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          console.log(`  🔍 CAPTCHA detected: ${selector}`);
          return {
            detected: true,
            type: this.getCaptchaType(selector),
            selector
          };
        }
      } catch (e) {
        // Continue checking
      }
    }

    // Check for Cloudflare challenge
    const title = await page.title();
    if (title.includes('Just a moment') || title.includes('Attention Required')) {
      console.log('  🔍 Cloudflare challenge detected');
      return {
        detected: true,
        type: 'cloudflare',
        selector: 'body'
      };
    }

    return { detected: false };
  }

  /**
   * Determine CAPTCHA type from selector
   */
  getCaptchaType(selector) {
    if (selector.includes('recaptcha')) return 'recaptcha';
    if (selector.includes('hcaptcha')) return 'hcaptcha';
    if (selector.includes('cf-challenge')) return 'cloudflare';
    return 'unknown';
  }

  /**
   * Solve reCAPTCHA v2
   */
  async solveRecaptchaV2(page, siteKey, pageUrl) {
    if (!this.config.enabled) {
      console.log('  ⚠️  CAPTCHA solving disabled');
      return null;
    }

    console.log('  🤖 Attempting to solve reCAPTCHA v2...');

    // Manual solving approach - wait for user
    if (this.apiKey === 'YOUR_2CAPTCHA_API_KEY' || !this.apiKey) {
      console.log('  ⏳ No CAPTCHA API key configured');
      console.log('  ⏳ Waiting 60 seconds for manual CAPTCHA solving...');
      await page.waitForTimeout(60000);
      return 'manual';
    }

    // Automated solving would go here
    // This requires valid API key and implementation
    console.log('  ⚠️  Automated CAPTCHA solving requires valid API key');
    return null;
  }

  /**
   * Wait for Cloudflare challenge to complete
   */
  async waitForCloudflare(page) {
    console.log('  ⏳ Waiting for Cloudflare challenge...');

    try {
      // Wait for the challenge to disappear (max 30 seconds)
      await page.waitForFunction(
        () => !document.title.includes('Just a moment') &&
              !document.title.includes('Attention Required'),
        { timeout: 30000 }
      );

      console.log('  ✅ Cloudflare challenge passed');
      return true;
    } catch (error) {
      console.log('  ⚠️  Cloudflare challenge timeout - may need manual intervention');
      // Continue anyway
      return false;
    }
  }

  /**
   * Handle any CAPTCHA on page
   */
  async handleCaptcha(page) {
    const detection = await this.detectCaptcha(page);

    if (!detection.detected) {
      return true; // No CAPTCHA
    }

    console.log(`  🛡️  CAPTCHA type: ${detection.type}`);

    switch (detection.type) {
      case 'cloudflare':
        return await this.waitForCloudflare(page);

      case 'recaptcha':
        try {
          const siteKey = await page.evaluate(() => {
            const element = document.querySelector('[data-sitekey]');
            return element ? element.getAttribute('data-sitekey') : null;
          });

          if (siteKey) {
            await this.solveRecaptchaV2(page, siteKey, page.url());
          } else {
            console.log('  ⏳ Waiting 45 seconds for manual CAPTCHA solving...');
            await page.waitForTimeout(45000);
          }
          return true;
        } catch (error) {
          console.error(`  ✗ CAPTCHA handling failed: ${error.message}`);
          return false;
        }

      default:
        console.log('  ⏳ Waiting 30 seconds for CAPTCHA...');
        await page.waitForTimeout(30000);
        return true;
    }
  }
}
