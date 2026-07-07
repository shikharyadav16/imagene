// services/generate.js
import puppeteer from 'puppeteer';   // full package – NOT puppeteer-core

export default async function generateCraiyonImage(prompt) {
  let browser = null;

  try {
    // Launch with zero custom paths – Puppeteer finds its own bundled Chromium
    browser = await puppeteer.launch({
      headless: true,                // or 'new' for newer versions
      args: [
        '--disable-blink-features=AutomationControlled',
        // On Windows, --no-sandbox is NOT needed – remove it
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    );

    console.log('🌐 Navigating to Craiyon...');
    await page.goto('https://www.craiyon.com/en', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Wait for UI to ensure challenge is passed
    await page.waitForSelector('input[type="text"]', { timeout: 30000, visible: true })
      .catch(() => console.warn('⚠️ Input field not found – continuing.'));

    console.log('✅ Page ready – calling API...');

    // Execute the API call inside the browser
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
      }
      throw new Error('No image URL in response.');
    }, prompt);

    console.log('✅ Image generated – downloading...');

    // Download and encode image as base64
    const imageResponse = await fetch(result.url);
    if (!imageResponse.ok) {
      throw new Error(`Image download failed (${imageResponse.status})`);
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/png';
    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return `data:${contentType};base64,${base64}`;

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔄 Browser closed.');
    }
  }
}