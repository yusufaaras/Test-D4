const embeddingEndpoint = "https://ai-gptai749384661431.openai.azure.com/openai/deployments/text-embedding-ada-002/embeddings?api-version=2023-05-15";
const embeddingApiKey = "11x9IG7HZkyphyxj7I41UPWOshDNpWJAvUdiuUeVoxnMy6CPsY5cJQQJ99BDACYeBjFXJ3w3AAAAACOGQMYE";

// Chat conversation history
let conversationHistory = [];
let currentWebResults = []; // Store current web results for subsequent queries

async function searchApi(query) {
    const apiKey = "AIzaSyCV6D4-h5d29pjpVMWHhiM-vSzJex0s8E4";
    const cx = "21532602d608644a6";

    try {
        const response = await fetch(
            `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${apiKey}&cx=${cx}`
        );

        const data = await response.json();

        if (data.items && Array.isArray(data.items)) {
            return data.items.map((item) => ({
                title: item.title,
                snippet: item.snippet,
                link: item.link,
            }));
        } else {
            return [];
        }
    } catch (error) {
        console.error("Web arama hatası:", error);
        return [];
    }
}

// Embedding oluşturma fonksiyonu
async function getEmbedding(text) {
    const response = await fetch(embeddingEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "api-key": embeddingApiKey,
        },
        body: JSON.stringify({
            input: text,
            model: "text-embedding-ada-002",
        }),
    });

    if (!response.ok) {
        throw new Error("Embedding API hatası: " + response.status);
    }

    const data = await response.json();
    return data.data[0].embedding; // embedding vektörü döner
}

// İki vektör arasındaki cosine similarity hesaplama
function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
    const magB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
    return dotProduct / (magA * magB);
}

// AI’ya soruyu gönderme, gömülü en yakın metni de ekleyerek
async function askOpenAIWithEmbedding(question, closestText) {
    const apiKey = "33UVBdsOXYuThfNXPD80IpUjjxRh6aw2CzDRi5U988ySHG5lWU1OJQQJ99BDACHYHv6XJ3w3AAAAACOGM9JC";
    const endpoint = "https://au-m9vezg5i-eastus2.services.ai.azure.com/openai/deployments/gpt-4.1/chat/completions?api-version=2023-05-15";

    // Prepare messages for the OpenAI API, including conversation history
    const apiMessages = [
        { role: "system", content: "You are a helpful assistant for construction data. The current year is 2025. Please provide detailed answers, using Markdown for clear headings, bullet points, and tables. For tables, use standard Markdown table syntax. Separate major sections with '---'. Keep responses concise but informative for a chat context." },
        ...conversationHistory.map(msg => ({ role: msg.sender === 'user' ? 'user' : 'assistant', content: msg.text })),
        {
            role: "user",
            content: `User question: ${question}\n\nHere is the most relevant information retrieved based on embeddings:\n${closestText}\n\nPlease provide a detailed answer based on this.`,
        },
    ];

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: "gpt-4.1",
            messages: apiMessages,
            max_tokens: 5000,
            temperature: 0.7,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
        }),
    });

    if (!response.ok) {
        throw new Error("API request failed with status " + response.status);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

// Kullanıcı sorgusu ve web sonuçlarını embedding ile en iyi eşleşmeyi bulup AI’a gönderme
async function processQueryWithEmbedding(query, webResults) {
    // Kullanıcı sorusunun embeddingi
    const queryEmbedding = await getEmbedding(query);

    // Web sonuçlarının snippet/text embeddinglerini al ve cosine similarity hesapla
    const embeddings = await Promise.all(
        webResults.map(item => getEmbedding(item.snippet))
    );

    // En yüksek benzerlikli snippet indeksini bul
    let maxSim = -1;
    let maxIndex = -1;
    embeddings.forEach((embedding, idx) => {
        const sim = cosineSimilarity(queryEmbedding, embedding);
        if (sim > maxSim) {
            maxSim = sim;
            maxIndex = idx;
        }
    });

    // En yakın snippet veya yoksa genel web özetini kullan
    const closestText = maxIndex !== -1 ? webResults[maxIndex].snippet : "No relevant web information found.";

    // AI’dan cevabı al
    const answer = await askOpenAIWithEmbedding(query, closestText);
    return answer;
}

// Function to format the AI's raw text response into structured HTML
function formatAiResponse(responseText) {
    let formattedHtml = '';
    const lines = responseText.split('\n').filter(line => line.trim() !== '');

    let inTable = false;
    let tableHeader = [];
    let inList = false;

    lines.forEach(line => {
        if (line.trim().startsWith('|') && line.includes('---')) {
            if (inList) {
                formattedHtml += '</ul>';
                inList = false;
            }
            if (!inTable) {
                inTable = true;
                const separatorIndex = lines.indexOf(line);
                if (separatorIndex > 0) {
                    tableHeader = lines[separatorIndex - 1].split('|').map(h => h.trim()).filter(h => h !== '');
                } else {
                    tableHeader = [];
                }
                formattedHtml += '<table class="min-w-full bg-gray-900 rounded-lg overflow-hidden shadow-md mb-4">';
                formattedHtml += '<thead><tr class="bg-blue-900/20">';
                tableHeader.forEach(header => {
                    formattedHtml += `<th class="px-4 py-2 text-left text-blue-300 font-semibold thin-border-blue">**${header}**</th>`;
                });
                formattedHtml += '</tr></thead><tbody>';
            }
            return;
        } else if (inTable && line.trim().startsWith('|')) {
            const rowData = line.split('|').map(d => d.trim()).filter(d => d !== '');
            formattedHtml += '<tr class="thin-border-white">';
            rowData.forEach(data => {
                formattedHtml += `<td class="px-4 py-2 thin-border-white text-sm">${data}</td>`;
            });
            formattedHtml += '</tr>';
        } else if (inTable && !line.trim().startsWith('|')) {
            inTable = false;
            formattedHtml += '</tbody></table>';
            if (line.trim() !== '') {
                formattedHtml += `<p class="mb-2 text-sm">${line}</p>`;
            }
        } else if (line.trim().startsWith('### ')) {
            if (inList) {
                formattedHtml += '</ul>';
                inList = false;
            }
            if (inTable) {
                formattedHtml += '</tbody></table>';
                inTable = false;
            }
            formattedHtml += `<h3 class="text-xl font-semibold text-blue-300 mt-4 mb-2">${line.substring(4).trim()}</h3>`;
        } else if (line.trim().startsWith('## ')) {
            if (inList) {
                formattedHtml += '</ul>';
                inList = false;
            }
            if (inTable) {
                formattedHtml += '</tbody></table>';
                inTable = false;
            }
            formattedHtml += `<h2 class="text-2xl font-bold text-blue-400 mt-6 mb-3">${line.substring(3).trim()}</h2>`;
        } else if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
            if (inTable) {
                formattedHtml += '</tbody></table>';
                inTable = false;
            }
            if (!inList) {
                formattedHtml += '<ul class="list-disc list-inside ml-4 mb-2">';
                inList = true;
            }
            formattedHtml += `<li class="text-sm">${line.substring(2).trim()}</li>`;
        } else {
            if (inList) {
                formattedHtml += '</ul>';
                inList = false;
            }
            if (inTable) {
                formattedHtml += '</tbody></table>';
                inTable = false;
            }
            if (line.trim() !== '') {
                const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
                let processedLine = line;
                let match;
                while ((match = linkRegex.exec(line)) !== null) {
                    const fullMatch = match[0];
                    const linkText = match[1];
                    const linkUrl = match[2];
                    processedLine = processedLine.replace(fullMatch, `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline text-sm">${linkText}</a>`);
                }
                formattedHtml += `<p class="mb-2 text-sm">${processedLine}</p>`;
            }
        }
    });

    if (inList) {
        formattedHtml += '</ul>';
    }
    if (inTable) {
        formattedHtml += '</tbody></table>';
    }

    return formattedHtml;
}


// DOM elementleri
const searchInput = document.getElementById("searchInput");
const popularQueries = document.getElementById("popularQueries");
const searchResults = document.getElementById("searchResults");
const aiSuggestions = document.getElementById("aiSuggestions");
const searchQuerySpan = document.getElementById("searchQuery");
const chatMessages = document.getElementById("chatMessages"); // Yeni sohbet mesajları container'ı
const chatInput = document.getElementById("chatInput"); // Yeni sohbet inputu
const sendMessageButton = document.getElementById("sendMessageButton"); // Yeni gönder butonu

// Function to display a message in the chat
function displayMessage(sender, textContent) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message-container'); // Use flex column on parent to center child message

    const messageBubble = document.createElement('div');
    messageBubble.classList.add('p-4', 'rounded-lg', 'max-w-[85%]');

    if (sender === 'user') {
        messageBubble.classList.add('user-message', 'self-end'); // Align right for user
    } else {
        messageBubble.classList.add('ai-message', 'self-start'); // Align left for AI
    }
    messageBubble.innerHTML = textContent; // Use innerHTML for formatted AI responses

    messageDiv.appendChild(messageBubble);
    chatMessages.appendChild(messageDiv);

    // Scroll to the bottom of the chat
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Ana arama ve sohbet işleme fonksiyonu
async function handleSearch(query) {
    if (!query) return;

    popularQueries.style.display = "none";
    searchResults.classList.remove("hidden");
    aiSuggestions.classList.remove("hidden");
    searchQuerySpan.textContent = query;

    // Add user message to conversation history and display
    conversationHistory.push({ sender: 'user', text: query });
    displayMessage('user', query);

    // Show a loading indicator for AI response
    displayMessage('ai', '<i class="fas fa-spinner fa-spin"></i> Thinking...');

    try {
        // Perform web search only if it's the initial query or if needed
        let webResults = currentWebResults;
        if (conversationHistory.length === 1 || query.toLowerCase().includes("search web for")) { // Simple heuristic
            webResults = await searchApi(query);
            currentWebResults = webResults; // Store for subsequent use
        }

        const answer = await processQueryWithEmbedding(query, webResults);

        // Remove loading indicator and display AI answer
        chatMessages.lastChild.remove(); // Remove the loading spinner
        const formattedAiAnswer = formatAiResponse(answer);
        conversationHistory.push({ sender: 'ai', text: answer }); // Store raw text for AI model
        displayMessage('ai', formattedAiAnswer);

        // Display web results in the suggestions section
        if (currentWebResults.length > 0) {
            suggestionsContent.innerHTML =
                `<p class="text-sm font-semibold text-gray-300 mb-2">Relevant Web Results:</p><ul class="list-disc ml-4 text-sm space-y-1">` +
                currentWebResults
                    .map(
                        (item) =>
                            `<li><a href="${item.link}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">${item.title}</a>: ${item.snippet}</li>`
                    )
                    .join("") +
                `</ul>`;
        } else {
            suggestionsContent.innerHTML = `<p class="text-sm">No new web suggestions available for this query.</p>`;
        }
    } catch (error) {
        chatMessages.lastChild.remove(); // Remove the loading spinner
        displayMessage('ai', `<p style="color:red">Error: ${error.message}</p>`);
        suggestionsContent.innerHTML = `<p class="text-sm" style="color:red">Error fetching web results or AI response.</p>`;
    } finally {
        chatInput.value = ""; // Clear chat input after sending
    }
}

// Event Listeners
searchInput.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
        const query = searchInput.value.trim();
        if (!query) return;
        conversationHistory = []; // Clear history for a new initial search
        await handleSearch(query);
    }
});

sendMessageButton.addEventListener("click", async () => {
    const query = chatInput.value.trim();
    if (!query) return;
    await handleSearch(query);
});

chatInput.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
        const query = chatInput.value.trim();
        if (!query) return;
        await handleSearch(query);
    }
});


// Optional: Add event listeners for popular queries to populate search input
document.querySelectorAll('#popularQueries li').forEach(item => {
    item.addEventListener('click', () => {
        searchInput.value = item.textContent.trim();
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });
});