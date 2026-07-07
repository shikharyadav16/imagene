// craiyon.js
import puppeteer from 'puppeteer';  // full package – includes Chromium

/**
 * Generates an image from Craiyon using Puppeteer's bundled Chromium.
 * @param {string} prompt - The image description.
 * @returns {Promise<string>} - Base64 data URL of the image.
 */
async function generateCraiyonImage(prompt) {
  let browser = null;

  try {
    // Launch with standard args (no need for --no-sandbox on Windows)
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        // '--no-sandbox' is not needed on Windows
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

    await page.waitForSelector('input[type="text"]', { timeout: 30000, visible: true })
      .catch(() => console.warn('⚠️ Input field not found – continuing.'));

    console.log('✅ Page ready – calling API...');

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

// Example usage (save image to file)
// const imageData = await generateCraiyonImage('a dog with a red hat and a smile');
// console.log('Data URL length:', imageData.length);
export default generateCraiyonImage;
// To save as file:
// const fs = require('fs');
// fs.writeFileSync('output.png', imageData.split(',')[1], 'base64');
// console.log('✅ Saved as output.png');