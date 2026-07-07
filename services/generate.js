// services/generate.js
import puppeteer from 'puppeteer';   // ✅ Use full package
import fs from 'fs';
import path from 'path';

function findChromeExecutable() {
  // On Render, look for the installed Chromium
  if (process.env.RENDER) {
    const baseDir = '/opt/render/.cache/puppeteer/chrome';
    if (fs.existsSync(baseDir)) {
      const dirs = fs.readdirSync(baseDir).filter(d => d.startsWith('linux-'));
      if (dirs.length > 0) {
        const versionDir = dirs.sort().reverse()[0];
        const exePath = path.join(baseDir, versionDir, 'chrome-linux64', 'chrome');
        if (fs.existsSync(exePath)) {
          console.log(`✅ Found Chrome at: ${exePath}`);
          return exePath;
        }
      }
    }
  }
  // For local development, return undefined to let Puppeteer use its bundled Chromium
  return undefined;
}

export default async function generateCraiyonImage(prompt) {
  let browser = null;
  try {
    const executablePath = findChromeExecutable();
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    };
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }

    console.log('🚀 Launching browser...');
    browser = await puppeteer.launch(launchOptions);

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