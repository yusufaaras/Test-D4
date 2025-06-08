import React, { useEffect, useRef, useState } from "react";
import "./ScrapeDetails.css";

const GEMINI_API_KEY = "AIzaSyC6a6LRfX_nAPTFmyoDEHj6uW8pl-J8n_c";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

export default function ScrapeDetails({ scrapelessData, selectedLink }) {
  const [messages, setMessages] = useState([
    { role: "ai", text: "Veriler analiz ediliyor..." }
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [streamedAnswer, setStreamedAnswer] = useState("");
  const chatEndRef = useRef(null);
  const [aiReady, setAiReady] = useState(false);

  // Chat veya cevap değiştiğinde en alta scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamedAnswer]);

  // scrapelessData değişirse ilk AI mesajı otomatik gönder
  useEffect(() => {
    if (scrapelessData && !aiReady) {
      setMessages([
        { role: "ai", text: "Bu site hakkında size nasıl yardımcı olabilirim?" }
      ]);
      setAiReady(true);
    } else if (!scrapelessData) {
      setMessages([
        { role: "ai", text: "Veriler analiz ediliyor..." }
      ]);
      setAiReady(false);
    }
    setInput("");
    setStreamedAnswer("");
    setPending(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrapelessData, selectedLink, aiReady]); // aiReady eklendi (eslint hatası çözümü)

  // Gemini prompt builder
  const buildGeminiPrompt = (history, userMessage) => {
    let histText = history
      .map(m => (m.role === "user" ? `Kullanıcı: ${m.text}` : `AI: ${m.text}`))
      .join("\n");
    return `
Yıl 2025. Aşağıda bir web sayfasından çıkarılmış veri seti var. Kullanıcı sana bu siteyle ilgili herhangi bir konuda soru sorabilir, lütfen yalnızca bu veriler ve güncel 2025 bilgilerinle detaylı ve net cevap ver.

--- VERİ SETİ ---
${JSON.stringify(scrapelessData, null, 2)}
--- SONU ---
Önceki sohbet:
${histText}

Kullanıcı: ${userMessage}
AI:
`;
  };

  // Gemini'ye istek at, streaming gibi kelime kelime yazdır
  async function askGeminiStreaming(newHistory, userMessage) {
    setPending(true);
    setStreamedAnswer("");
    const prompt = buildGeminiPrompt(newHistory, userMessage);

    const body = {
      contents: [
        { parts: [ { text: prompt } ] }
      ]
    };

    try {
      const res = await fetch(GEMINI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const d = await res.json();
      const fullText = d?.candidates?.[0]?.content?.parts?.[0]?.text || "Yanıt alınamadı.";

      // no-loop-func hatası için forEach ve closure kullan!
      let progressiveText = "";
      const words = fullText.split(/(\s+)/);
      // forEach yerine klasik for ile indexi closure'a al
      const streamWords = async () => {
        for (let idx = 0; idx < words.length; idx++) {
          progressiveText += words[idx];
          setStreamedAnswer(progressiveText);
          // Nokta, soru işareti, ünlemde biraz daha beklet
          const wait = /[.?!]\s*$/.test(words[idx]) ? 120 : 35;
          // eslint-disable-next-line no-await-in-loop
          await new Promise(r => setTimeout(r, wait));
        }
      };
      await streamWords();
      setMessages(m => [
        ...m,
        { role: "ai", text: fullText }
      ]);
    } catch {
      setStreamedAnswer("AI'dan yanıt alınamadı.");
      setMessages(m => [
        ...m,
        { role: "ai", text: "AI'dan yanıt alınamadı." }
      ]);
    }
    setPending(false);
  }

  const handleSend = async () => {
    if (!input.trim() || pending || !aiReady) return;
    const userMessage = input;
    setMessages(m => [
      ...m,
      { role: "user", text: userMessage }
    ]);
    setInput("");
    await askGeminiStreaming(
      [...messages, { role: "user", text: userMessage }],
      userMessage
    );
  };

  const handleKeyDown = e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // AI alanı açılınca en alta scroll
  useEffect(() => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 150);
  }, [aiReady]);

  return (
    <div className="ai-chat-panel">
      <div className="ai-chat-link-indicator">
        <span className="ai-chat-link-label">Seçilen link:</span>
        <a href={selectedLink} target="_blank" rel="noopener noreferrer">{selectedLink}</a>
        <span className="ai-chat-link-desc">&nbsp;ile ilgili sohbet ediyorsunuz.</span>
      </div>
      <div className="ai-chat-history">
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === "user" ? "ai-chat-msg user" : "ai-chat-msg ai"}>
            <b>{msg.role === "user" ? "Sen:" : "AI:"}</b> {msg.text}
          </div>
        ))}
        {pending && (
          <div className="ai-chat-msg ai">
            <b>AI:</b> <span className="typing">{streamedAnswer}<span className="typing-cursor">▍</span></span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="ai-chat-input-row">
        <textarea
          className="ai-chat-input"
          rows={1}
          value={input}
          placeholder={aiReady ? "Sorunuzu yazın ve Enter'a basın..." : "Veriler gelmeden soru soramazsınız"}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={pending || !aiReady}
        />
        <button className="ai-chat-send-btn" onClick={handleSend} disabled={pending || !input.trim() || !aiReady}>Gönder</button>
      </div>
    </div>
  );
}