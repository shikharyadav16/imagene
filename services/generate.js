// services/generate.js
import puppeteer from 'puppeteer-core';

/**
 * Generates an image from Craiyon using Render's built‑in Chrome.
 * @param {string} prompt - Text description of the image.
 * @returns {Promise<string>} - Base64 data URL of the generated image.
 */
export default async function generateCraiyonImage(prompt) {
  let browser = null;

  try {
    // Launch with Render's Chrome executable
    browser = await puppeteer.launch({
      executablePath: '/usr/bin/google-chrome-stable', // Render's path
      headless: true,
      args: [
        '--no-sandbox',                 // required on Linux servers
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',      // avoids memory issues on /dev/shm
        '--disable-blink-features=AutomationControlled',
      ],
    });

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

    // Wait for the main UI to confirm the challenge is passed
    await page.waitForSelector('input[type="text"]', {
      timeout: 30000,
      visible: true,
    }).catch(() => {
      console.warn('⚠️ Input field not found – but continuing anyway.');
    });

    console.log('✅ Page ready – calling the API from the browser...');

    // Perform the API request inside the browser context
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

    // Download the image and convert to base64 data URL
    const imageResponse = await fetch(result.url);
    if (!imageResponse.ok) {
      throw new Error(`Image download failed (${imageResponse.status})`);
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/png';
    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    return dataUrl;

  } catch (error) {
    console.error('❌ Error in generateCraiyonImage:', error.message);
    throw error; // rethrow for the caller to handle
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔄 Browser closed.');
    }
  }
}