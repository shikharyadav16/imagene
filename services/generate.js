// services/generate.js
import puppeteer from 'puppeteer';

/**
 * Generates an image from Craiyon.
 * @param {string} prompt - Image description.
 * @returns {Promise<string>} - Base64 data URL of the image.
 */
export default async function generateCraiyonImage(prompt) {
  let browser = null;

  try {
    // Let Puppeteer find its bundled Chromium (via the .puppeteerrc.js config)
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',                 // required on Linux
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',      // avoids /dev/shm issues
        '--disable-blink-features=AutomationControlled',
      ],
    };

    console.log('🚀 Launching browser with Puppeteer\'s bundled Chromium...');
    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    );

    console.log('🌐 Navigating to Craiyon to solve Cloudflare challenge...');
    await page.goto('https://www.craiyon.com/en', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    await page.waitForSelector('input[type="text"]', {
      timeout: 30000,
      visible: true,
    }).catch(() => {
      console.warn('⚠️ Input field not found – continuing anyway.');
    });

    console.log('✅ Page ready – calling the API from the browser...');

    const result = await page.evaluate(async (prompt) => {
      const payload = {
        prompt,
        negative_prompt: '',
        model: 'auto',
        aspect_ratio: 'auto',
        n_images: 1,
      };

      const response = await fetch('/api/image/draw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': '*/*',
          'Origin': 'https://www.craiyon.com',
          'Referer': 'https://www.craiyon.com/en',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`API Error (${response.status}): ${text.slice(0, 200)}`);
      }

      const data = await response.json();
      if (data.results && data.results.length > 0) {
        return { url: data.results[0].url };
      } else {
        throw new Error('No image URL in the response.');
      }
    }, prompt);

    console.log('✅ Image generated – downloading...');

    const imageResponse = await fetch(result.url);
    if (!imageResponse.ok) {
      throw new Error(`Image download failed (${imageResponse.status})`);
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/png';
    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return `data:${contentType};base64,${base64}`;

  } catch (error) {
    console.error('❌ Error in generateCraiyonImage:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔄 Browser closed.');
    }
  }
}