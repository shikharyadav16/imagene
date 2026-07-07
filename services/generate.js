// craiyon.js
import puppeteer from 'puppeteer';

/**
 * Generates an image from Craiyon.
 * The entire process (Cloudflare challenge + API call) runs inside Puppeteer.
 * @param {string} prompt - The image description.
 * @returns {Promise<string>} - The URL of the generated image.
 */
async function generateCraiyonImage(prompt) {
  const browser = await puppeteer.launch({
    headless: true,          // Set to false to watch
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    );

    console.log('🌐 Navigating to Craiyon to solve Cloudflare challenge...');
    await page.goto('https://www.craiyon.com/en', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait for the main UI to be visible (ensures challenge is passed)
    await page.waitForSelector('input[type="text"]', {
      timeout: 30000,
      visible: true
    }).catch(() => {
      console.warn('⚠️ Input field not found – but continuing.');
    });

    console.log('✅ Page loaded – now calling the API from the browser...');

    // 2. Execute the API call inside the browser page
    const imageUrl = await page.evaluate(async (prompt) => {
      const payload = {
        prompt,
        negative_prompt: '',
        model: 'auto',
        aspect_ratio: 'auto',
        n_images: 1
      };

      const response = await fetch('/api/image/draw', {  // relative URL – works because we're on craiyon.com
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': '*/*',
          'Origin': 'https://www.craiyon.com',
          'Referer': 'https://www.craiyon.com/en',
          // No need to set Cookie – browser handles it automatically
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`API Error (${response.status}): ${text.slice(0, 200)}`);
      }

      const data = await response.json();
      if (data.results && data.results.length > 0) {
        return data.results[0].url;
      } else {
        throw new Error('No image URL in response.');
      }
    }, prompt);

    console.log('✅ Image generated!');

    if (imageUrl.startsWith('data:')) {
      return imageUrl;
    }

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Image download failed (${imageResponse.status})`);
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/png';
    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return `data:${contentType};base64,${base64}`;

  } catch (error) {
    // Ensure browser is closed on error
    await browser.close().catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
}

export default generateCraiyonImage;