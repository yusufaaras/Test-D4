const embeddingEndpoint = "https://ai-gptai749384661431.openai.azure.com/openai/deployments/text-embedding-ada-002/embeddings?api-version=2023-05-15";
const embeddingApiKey = "11x9IG7HZkyphyxj7I41UPWOshDNpWJAvUdiuUeVoxnMy6CPsY5cJQQJ99BDACYeBjFXJ3w3AAAAACOGQMYE";

let conversationHistory = [];
let currentWebResults = [];  

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

// Embedding  
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
    return data.data[0].embedding;  
}
 
function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
    const magB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
    return dotProduct / (magA * magB);
}

async function askOpenAIWithEmbedding(question, closestText, onChunkReceived) {
    const apiKey = "33UVBdsOXYuThfNXPD80IpUjjxRh6aw2CzDRi5U988ySHG5lWU1OJQQJ99BDACHYHv6XJ3w3AAAAACOGM9JC";
    const endpoint = "https://au-m9vezg5i-eastus2.services.ai.azure.com/openai/deployments/gpt-4.1/chat/completions?api-version=2023-05-15";

    const apiMessages = [
        {
            role: "system",
            content: "You are a helpful assistant for construction data. The current year is 2025. Please provide **concise, clear, and to-the-point** answers. Organize your responses using **bullet points** or **tables**. If possible, include **source links** supporting your answer, formatted as `[Source Name](source_link)` either in parentheses or at the end of the relevant sentence. Separate major sections with '---'. Ensure responses are **informative and easy to understand**, fitting a chat context.",
        },        ...conversationHistory.map(msg => ({ role: msg.sender === 'user' ? 'user' : 'assistant', content: msg.text })),
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
            stream: true, //akis olacak mi ? true
        }),
    });

    if (!response.ok) {
        throw new Error("API request failed with status " + response.status);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullResponse = "";
    let buffer = "";

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
 
        const lines = buffer.split('\n');
        buffer = lines.pop();  

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const jsonStr = line.substring(6);
                if (jsonStr === '[DONE]') {
                    reader.cancel();  
                    return fullResponse;
                }
                try {
                    const parsed = JSON.parse(jsonStr);
                    const content = parsed.choices[0]?.delta?.content || "";
                    fullResponse += content;
                    onChunkReceived(content);  
                } catch (e) {
                    console.warn("JSON parsing error:", e, "on line:", jsonStr);
                }
            }
        }
    }
    return fullResponse;  
}

// Kullanıcı sorgusu ve web sonuçlarını embedding ile en iyi eşleşmeyi bulup AI’a gönderme
async function processQueryWithEmbedding(query, webResults) { 
    const queryEmbedding = await getEmbedding(query); 
    const embeddings = await Promise.all(
        webResults.map(item => getEmbedding(item.snippet))
    );
 
    let maxSim = -1;
    let maxIndex = -1;
    embeddings.forEach((embedding, idx) => {
        const sim = cosineSimilarity(queryEmbedding, embedding);
        if (sim > maxSim) {
            maxSim = sim;
            maxIndex = idx;
        }
    });
 
    const closestText = maxIndex !== -1 ? webResults[maxIndex].snippet : "No relevant web information found.";
 
    const answer = await askOpenAIWithEmbedding(query, closestText);
    return answer;
}
 
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
                    formattedHtml += `<th class="px-4 py-2 text-left text-blue-300 font-semibold thin-border-blue">${header}</th>`;
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

 
const searchInput = document.getElementById("searchInput");
const popularQueries = document.getElementById("popularQueries");
const searchResults = document.getElementById("searchResults");
const aiSuggestions = document.getElementById("aiSuggestions");
const searchQuerySpan = document.getElementById("searchQuery");
const chatMessages = document.getElementById("chatMessages"); 
const chatInput = document.getElementById("chatInput");  
const sendMessageButton = document.getElementById("sendMessageButton"); 
 
function displayMessage(sender, textContent) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message-container'); 

    const messageBubble = document.createElement('div');
    messageBubble.classList.add('p-4', 'rounded-lg', 'max-w-[85%]');

    if (sender === 'user') {
        messageBubble.classList.add('user-message', 'self-end');  
    } else {
        messageBubble.classList.add('ai-message', 'self-start');  
    }
    messageBubble.innerHTML = textContent; 

    messageDiv.appendChild(messageBubble);
    chatMessages.appendChild(messageDiv);
 
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
 
// Ana arama ve sohbet işleme  
async function handleSearch(query) {
    if (!query) return;

    popularQueries.style.display = "none";
    searchResults.classList.remove("hidden");
    aiSuggestions.classList.remove("hidden");
    searchQuerySpan.textContent = query;
 
    conversationHistory.push({ sender: 'user', text: query });
    displayMessage('user', query);
 
    const aiMessageDiv = document.createElement('div');
    aiMessageDiv.classList.add('message-container');
    const aiMessageBubble = document.createElement('div');
    aiMessageBubble.classList.add('ai-message', 'self-start');
    aiMessageBubble.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Thinking...';
    aiMessageDiv.appendChild(aiMessageBubble);
    chatMessages.appendChild(aiMessageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;  

    let currentAiResponseContent = "";  

    try {
        let webResults = currentWebResults;
        if (conversationHistory.length === 1 || query.toLowerCase().includes("search web for")) {
            webResults = await searchApi(query);
            currentWebResults = webResults;
        }
 
        const queryEmbedding = await getEmbedding(query);
        const embeddings = await Promise.all(
            webResults.map(item => getEmbedding(item.snippet))
        );
        let maxSim = -1;
        let maxIndex = -1;
        embeddings.forEach((embedding, idx) => {
            const sim = cosineSimilarity(queryEmbedding, embedding);
            if (sim > maxSim) {
                maxSim = sim;
                maxIndex = idx;
            }
        });
        const closestText = maxIndex !== -1 ? webResults[maxIndex].snippet : "No relevant web information found."; 
        const relevantWebInfo = maxIndex !== -1 ?
            `Title: ${webResults[maxIndex].title}\nSnippet: ${webResults[maxIndex].snippet}\nLink: ${webResults[maxIndex].link}` :
            "No relevant web information found."; 
        const answer = await askOpenAIWithEmbedding(query, relevantWebInfo, (chunk) => { /* ... */ });
 
        aiMessageBubble.innerHTML = '';

        const fullAnswer = await askOpenAIWithEmbedding(query, closestText, (chunk) => { 
            currentAiResponseContent += chunk;
            aiMessageBubble.innerHTML = formatAiResponse(currentAiResponseContent);  
            chatMessages.scrollTop = chatMessages.scrollHeight;  
        });
 
        conversationHistory.push({ sender: 'ai', text: fullAnswer });
 
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
        aiMessageBubble.innerHTML = `<p style="color:red">Error: ${error.message}</p>`;
        suggestionsContent.innerHTML = `<p class="text-sm" style="color:red">Error fetching web results or AI response.</p>`;
    } finally {
        chatInput.value = "";  
    }
}
 
searchInput.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
        const query = searchInput.value.trim();
        if (!query) return;
        conversationHistory = [];  
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

 
document.querySelectorAll('#popularQueries li').forEach(item => {
    item.addEventListener('click', () => {
        searchInput.value = item.textContent.trim();
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });
});