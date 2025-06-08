import React, { useState, useRef, useEffect } from "react";
import "./App.css";
import ScrapeDetails from "./components/ScrapeDetails";

const GOOGLE_API_KEY = "AIzaSyDaHV-YfOjdRIcl7gFhLpU61Ev88XI6hQ4";
const CX = "c0ed3e4fd6f094129";

function App() {
  const [query, setQuery] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [results, setResults] = useState([]);
  const [scrapeData, setScrapeData] = useState(null);
  const [selectedLink, setSelectedLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [startIndex, setStartIndex] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // AI alanı açılıyor mu (veri bekleniyor mu?)
  const [aiLoading, setAiLoading] = useState(false);

  // Referans: AI chat paneline scroll için
  const aiChatRef = useRef(null);

  // Anahtar kelimeleri backend ile al
  const extractKeywords = async (text) => {
    const res = await fetch("/api/nlweb-keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return await res.json();
  };

  // Google araması
  const googleSearch = async (searchString, start = 1, pageSize = 5) => {
    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(searchString)}&key=${GOOGLE_API_KEY}&cx=${CX}&num=${pageSize}&start=${start}`;
    const res = await fetch(url);
    return await res.json();
  };

  // Arama zinciri
  const doSearch = async (e, isNew = true) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setResults(isNew ? [] : results);
    setScrapeData(null);
    setSelectedLink("");
    setAiLoading(false);

    let keys = keywords;
    if (isNew) {
      keys = await extractKeywords(query);
      setKeywords(keys);
      setStartIndex(1);
    }
    const searchString = keys.length ? keys.join(" ") : query;
    const pageSize = 5;
    const currentStart = isNew ? 1 : startIndex;

    const data = await googleSearch(searchString, currentStart, pageSize);
    const items = data.items || [];
    setResults(isNew ? items : [...results, ...items]);
    setHasMore((data.items || []).length === pageSize);
    setLoading(false);
    if (isNew) setStartIndex(pageSize + 1);
    else setStartIndex(currentStart + pageSize);
  };

  // AI'a Sor (scraping) ve en alta scroll
  const handleScrape = async (url) => {
    setScraping(true);
    setScrapeData(null);
    setSelectedLink(url);
    setAiLoading(true);

    // Hemen en alta scroll
    setTimeout(() => {
      aiChatRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 200);

    try {
      // Scrapeless'ten veriyi eksiksiz al
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      setScrapeData(data);
      setAiLoading(false);
    } catch {
      setScrapeData({ error: "Site detayı alınamadı." });
      setAiLoading(false);
    }
    setScraping(false);
  };

  // AI paneli açıldıysa otomatik en alta scroll
  useEffect(() => {
    if ((aiLoading || scrapeData) && aiChatRef.current) {
      setTimeout(() => {
        aiChatRef.current.scrollIntoView({ behavior: "smooth" });
      }, 200);
    }
  }, [aiLoading, scrapeData]);

  return (
    <div className="container">
      <form className="search-bar" onSubmit={e => doSearch(e, true)}>
        <input
          type="text"
          placeholder="Google'da ara..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button type="submit" disabled={loading}>Ara</button>
      </form>

      {keywords.length > 0 && (
        <div className="search-keywords">
          Anahtar kelimeler: {keywords.join(", ")}
        </div>
      )}

      <div className="search-results">
        {results.map((item, idx) => (
          <div className="result-item" key={item.cacheId || idx}>
            <div className="result-info">
              <a className="result-title" href={item.link} target="_blank" rel="noopener noreferrer">{item.title}</a>
              <span className="result-link">{item.displayLink || item.link}</span>
              <div className="result-snippet">{item.snippet}</div>
            </div>
            <button
              className="ai-ask-btn"
              onClick={() => handleScrape(item.link)}
              disabled={scraping}
            >
              AI'a Sor
            </button>
          </div>
        ))}
      </div>

      {hasMore && (
        <button className="load-more" onClick={e => doSearch(e, false)} disabled={loading}>
          Daha Fazla
        </button>
      )}

      {/* AI chat paneli veya bekleme mesajı buradan aşağıda */}
      <div ref={aiChatRef}></div>
      {aiLoading && (
        <div className="ai-chat-loading-area">
          <div className="ai-chat-loading-text">
            <span className="ai-chat-spinner" /> <b>LÜTFEN BEKLEYİNİZ, VERİLER ALINIYOR...</b>
          </div>
        </div>
      )}
      {!aiLoading && scrapeData && selectedLink &&
        <ScrapeDetails scrapelessData={scrapeData} selectedLink={selectedLink} />}
    </div>
  );
}

export default App;