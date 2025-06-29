import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import { ScrapingCrawl } from "@scrapeless-ai/sdk";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// NLWEB anahtar kelime çıkarma
const NLWEB_ENDPOINT = "https://nlweb.cognitiveservices.azure.com/text/analytics/v3.1/keyPhrases";
const NLWEB_KEY = "2dv6SQUJoCgsZuu1G3YCz5nkcGdzqMWYj7WLici2pLgzMWPJhCBlJQQJ99BEACYeBjFXJ3w3AAAEACOGPvoX";

// Scrapeless anahtarı
const SCRAPELESS_KEY = "sk_QbH1bOjBnbHnV0kPU5aNYYstVA1U6DtY9TzcwbC0ukUqtNwMwcv26ro6W0UjqgvN";

// Anahtar kelime çıkarma endpointi
app.post("/api/nlweb-keywords", async (req, res) => {
  try {
    const { text } = req.body;
    const response = await fetch(NLWEB_ENDPOINT, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": NLWEB_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ documents: [{ id: "1", language: "tr", text }] }),
    });
    const data = await response.json();
    res.json(data.documents[0]?.keyPhrases ?? []);
  } catch (e) {
    res.status(500).json({ error: "Anahtar kelime çıkarma hatası", details: e.message });
  }
});

// Scrapeless ile scraping endpointi
const client = new ScrapingCrawl({ apiKey: SCRAPELESS_KEY });

app.post("/api/scrape", async (req, res) => {
  try {
    const { url } = req.body;
    const scrapeResponse = await client.scrapeUrl(url, {
      browserOptions: {
        proxy_country: "ANY",
        session_name: "Crawl",
        session_recording: true,
        session_ttl: 900,
      },
    });
    res.json(scrapeResponse);
  } catch (e) {
    res.status(500).json({ error: "Scrapeless scraping hatası", details: e.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend proxy running on http://localhost:${PORT}`);
});