import puppeteer from "puppeteer";

async function generateCraiyonImage(prompt) {
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: puppeteer.executablePath(),
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

    console.log("Opening Craiyon...");

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

      return data.results[0].url;
    }, prompt);

    const image = await fetch(result);

    const buffer = Buffer.from(await image.arrayBuffer());

    return `data:image/png;base64,${buffer.toString("base64")}`;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export default generateCraiyonImage;