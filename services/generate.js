// craiyon.js
import puppeteer from 'puppeteer';

/**
 * Generates an image from Craiyon using Puppeteer's bundled Chromium.
 * Returns the image as a base64 data URL (ready for server responses).
 * @param {string} prompt - The image description.
 * @returns {Promise<string>} - Data URL of the generated image.
 */
async function generateCraiyonImage(prompt) {
  let browser = null;

  try {
    // 1. Launch Puppeteer using its bundled Chromium – no system Chrome needed.
    browser = await puppeteer.launch({
      headless: true,          // or 'new' for newer Puppeteer versions
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',    // fixes /dev/shm issues on some servers
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

    // Wait for the main UI to confirm the challenge is passed.
    await page.waitForSelector('input[type="text"]', {
      timeout: 30000,
      visible: true,
    }).catch(() => {
      console.warn('⚠️ Input field not found – but continuing anyway.');
    });

    console.log('✅ Page ready – calling the API from the browser...');

    // 2. Execute the API call inside the browser context.
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

    // 3. Download the image and convert to base64.
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
    // Rethrow so the caller can handle it.
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔄 Browser closed.');
    }
  }
}

// ----- Example usage (for testing) -----
async function main() {
  try {
    const imageDataUrl = await generateCraiyonImage('a dog with a red hat and a smile');
    console.log('🖼️ Image generated (data URL length):', imageDataUrl.length);
    // To save the image to a file:
    // const base64Data = imageDataUrl.split(',')[1];
    // require('fs').writeFileSync('output.png', base64Data, 'base64');
    // console.log('✅ Image saved as output.png');
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

// Run the example if this script is executed directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default generateCraiyonImage;