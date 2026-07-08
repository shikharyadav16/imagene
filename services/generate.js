// services/generate.js
import puppeteer from "puppeteer";
import fs from "fs";

function getChromePath() {
  // Allow overriding with environment variable
  if (
    process.env.PUPPETEER_EXECUTABLE_PATH &&
    fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)
  ) {
    console.log(
      `✅ Using Chrome from env: ${process.env.PUPPETEER_EXECUTABLE_PATH}`
    );
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // Common Linux locations
  const candidates = [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
  ];

  for (const chrome of candidates) {
    if (fs.existsSync(chrome)) {
      console.log(`✅ Found Chrome: ${chrome}`);
      return chrome;
    }
  }

  console.log("ℹ️ Using Puppeteer's bundled Chromium");
  return undefined;
}

export default async function generateCraiyonImage(prompt) {
  let browser;

  try {
    const executablePath = getChromePath();

    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-blink-features=AutomationControlled",
      ],
    });

    const page = await browser.newPage();

    await page.setViewport({
      width: 1280,
      height: 800,
    });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
    );

    console.log("🌐 Opening Craiyon...");

    await page.goto("https://www.craiyon.com/en", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    await page.waitForTimeout(3000);

    const result = await page.evaluate(async (prompt) => {
      const response = await fetch("/api/image/draw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "*/*",
          Origin: "https://www.craiyon.com",
          Referer: "https://www.craiyon.com/en",
        },
        body: JSON.stringify({
          prompt,
          negative_prompt: "",
          model: "auto",
          aspect_ratio: "auto",
          n_images: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();

      if (!data.results?.length) {
        throw new Error("No image returned");
      }

      return data.results[0].url;
    }, prompt);

    const image = await fetch(result);

    if (!image.ok) {
      throw new Error(`Image download failed (${image.status})`);
    }

    const buffer = Buffer.from(await image.arrayBuffer());

    return `data:image/png;base64,${buffer.toString("base64")}`;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}