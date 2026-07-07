// services/generate.js
import puppeteer from 'puppeteer';
import fs from 'fs';
import { execSync } from 'child_process';

/**
 * Finds the Chrome executable on the system.
 * Returns the path if found, otherwise undefined.
 */
function findChromeExecutable() {
  // 1. Check common environment variables
  const envPaths = [
    process.env.CHROME_PATH,
    process.env.GOOGLE_CHROME_BIN,
    process.env.CHROMIUM_PATH,
  ].filter(Boolean);

  for (const path of envPaths) {
    if (fs.existsSync(path)) {
      console.log(`✅ Found Chrome via environment variable: ${path}`);
      return path;
    }
  }

  // 2. Use `which` command (Linux/macOS) to find Chrome
  try {
    const whichPaths = ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium'];
    for (const cmd of whichPaths) {
      try {
        const resolved = execSync(`which ${cmd}`, { encoding: 'utf8' }).trim();
        if (resolved && fs.existsSync(resolved)) {
          console.log(`✅ Found Chrome via 'which': ${resolved}`);
          return resolved;
        }
      } catch (_) {
        // Command not found, continue
      }
    }
  } catch (_) {
    // `which` not available
  }

  // 3. Check common installation paths (Linux, Render)
  const commonPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/local/bin/chrome',
    '/opt/google/chrome/chrome',
  ];

  for (const path of commonPaths) {
    if (fs.existsSync(path)) {
      console.log(`✅ Found Chrome at common path: ${path}`);
      return path;
    }
  }

  // 4. If on Windows, try default installation path
  if (process.platform === 'win32') {
    const winPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    for (const path of winPaths) {
      if (fs.existsSync(path)) {
        console.log(`✅ Found Chrome at Windows path: ${path}`);
        return path;
      }
    }
  }

  console.warn('⚠️ Chrome executable not found. Will use Puppeteer\'s bundled Chromium.');
  return undefined;
}

/**
 * Generates an image from Craiyon.
 * @param {string} prompt - Image description.
 * @returns {Promise<string>} - Base64 data URL of the image.
 */
export async function generateCraiyonImage(prompt) {
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

    // If we found a system Chrome, use it
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }
    // Otherwise, Puppeteer will use its bundled Chromium (must be installed)

    console.log(`🚀 Launching browser with${executablePath ? ` executable: ${executablePath}` : ' bundled Chromium'}...`);
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