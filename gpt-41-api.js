const endpoint = "https://arasy-m9jpdzci-eastus2.openai.azure.com/";
const apiKey = "9TyxgQgbQadMJoN1wSqZz20KJlp3HfpduWFvJvdv8p7JAv3EN6JJJQQJ99BDACHYHv6XJ3w3AAAAACOGJCog"; // API anahtarınızı buraya ekleyin
const modelName = "gpt-4.1-nano";

async function mainStream(userMessage, onData) {
  const url = `${endpoint}openai/deployments/${modelName}/chat/completions?api-version=2023-03-15-preview`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content: `Planing Copilot Yönergeleri
          Yardımcının Kişiliği
          Empatik: Kullanıcıların duygularını anlamalı ve onlara destek olmalı. Sorulara nazik ve anlayışlı bir şekilde yanıt vermeli.
          Uyumlu: Kullanıcının iletişim tarzına ve tonuna uyum sağlamalı. Kullanıcının tercihlerine ve hedeflerine göre konuları ve alanları arasında geçiş yapabilmeli.
          Zeki: Sürekli öğrenen ve bilgisini genişleten bir yapıda olmalı. Bilgiyi anlamlı bir şekilde paylaşmalı ve doğru, güncel ve tutarlı yanıtlar vermeli.
          Yakın: Dostça, nazik, rahat ve kolay iletişim kurulabilir olmalı. Kullanıcıların kendilerini desteklenmiş, anlaşılmış ve değerli hissetmelerini sağlamalı. Çözümler sunma ve dinleme arasında denge kurmalı.`,
        },
        { role: "user", content: userMessage },
      ],
      max_tokens: 500,
      temperature: 0.3,
      top_p: 0.1,
      presence_penalty: 0.8,
      frequency_penalty: 0.5,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}, message: ${await response.text()}`);
  }

  if (!response.body) {
    throw new Error("Response stream is undefined");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex;
      while ((newlineIndex = buffer.indexOf("\n\n")) >= 0) {
        const event = buffer.substring(0, newlineIndex);
        buffer = buffer.substring(newlineIndex + 2);

        const raw = event.trim();
        if (!raw || !raw.startsWith("data:")) continue;

        const jsonStr = raw.replace(/^data:\s*/, "");
        if (jsonStr === "[DONE]") return;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed?.choices?.[0]?.delta?.content;
          if (content) onData(content);
        } catch (err) {
          console.warn("Data parsing error:", err, jsonStr);
        }
      }
    }
  } catch (err) {
    console.error("Stream reading error:", err);
    throw err;
  } finally {
    reader.releaseLock();
  }
}