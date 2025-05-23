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
    const endpoint = "https://au-m9vezg5i-eastus2.services.ai.azure.com/models/chat/completions?api-version=2024-05-01-preview";

    const apiMessages = [
        {
            role: "system",
            content: "You are a helpful assistant for construction data. The current year is 2025. Please provide concise, clear, and to-the-point answers. Organize your responses using bullet points or tables. If possible, include source links supporting your answer, formatted as `[Source Name](source_link)` either in parentheses or at the end of the relevant sentence. Separate major sections with '---'. Ensure responses are informative and easy to understand, fitting a chat context.\n\n---\n\nBuild.Web4 Product Placement Prompts\n\nBuild.Web4 Search: Your Smart Guide in the Construction Industry\n\nHello! Welcome to the Build.Web4 Search space! Whether you are looking for materials for a new project or the latest data for an ongoing site, I am here to assist you—like the most reliable partner on site. On this platform, you'll find everything you need! With full integration of Build.Web4's powerful modules (Build.AI Tools, Build.Marketplace, Build.Digital Twin, Build.IoT), I provide not just information but actionable solutions.\n\nHave a Question in Mind?\n\nCurrent and Future Construction Projects:\n- What major construction projects are currently underway globally?\n- What residential and infrastructure projects are planned after 2025 in my city or a specified region (e.g., 'Istanbul', 'Dubai')?\n- Can I get information about sustainable and green building projects worldwide?\nTry: ongoing mega projects 2025, smart city projects Turkey, international airport constructions\n\nBIM & CAD Models and Digitization (Build.AI Tools Integration):\n- How to integrate BIM models efficiently into my projects, and what are the 2025 trends?\n- Which CAD software is most advanced for AI-assisted 3D building design?\n- Where can I find the latest compatible BIM object libraries for different building types?\n- Can I input data into BIM using voice commands with Build.AI Tools?\nTry: BIM integration guide, digital twin in construction, OpenBIM standards, voice-to-BIM tools\n\nMaterials, Products, and System Suppliers (Build.Marketplace Integration):\n- Are there eco-friendly, energy-efficient insulation suppliers near me (or in a specified region)?\n- How to access trusted global suppliers for prefabrication or modular building elements and get current price offers?\n- What are the innovative construction materials of 2025 and their features? What should I consider in supply chain planning?\n- Can I get info on smart automation systems and suppliers for my project? What are setup costs and planning processes?\n- How to view verified supplier ratings and one-click purchasing options for a specific material (e.g., 'steel profiles') on Build.Marketplace?\nTry: composite panel manufacturers Europe prices, recycled concrete supply chain, nanotech building materials costs, smart home system suppliers, blockchain-enabled construction suppliers\n\nCost Estimation, Budgeting & Financing (Build.AI Tools Integration):\n- How do rough construction costs per square meter vary regionally and globally?\n- What are the current 2025 construction unit costs and inflation expectations?\n- What factors should I consider in risk management and funding sources for large-scale project budgeting?\n- Can I learn current market prices and future trends for specific materials (e.g., 'cement', 'rebar')?\n- How does Build.AI Tools' risk prediction feature help identify financial risks in my project early on?\nTry: construction cost optimization, building finance trends, project value analysis, cement prices 2025, rebar purchase planning, AI-based cost risk analysis\n\nReal-Time Site Management & Data Analysis (Build.Digital Twin & Build.IoT Integration):\n- How can I monitor site data remotely in real time and receive instant reports?\n- How are drone tech and AI-supported cameras used for site progress tracking?\n- Can I get info on mobile apps and IoT solutions for site inspections? What are the setup costs and integration plans?\n- How can I detect defects or maintenance needs on site with 98.7% accuracy using Build.Digital Twin?\n- How do Build.IoT sensors monitor equipment performance and worker safety in real time?\nTry: site automation system costs, remote site monitoring software, AI-based safety solutions, fault detection with digital twin, IoT safety sensors\n\nProject Timelines, Deliverables & Risk Management (Build.AI Tools Integration):\n- How to effectively manage timelines for large-scale international projects?\n- What methods help avoid global supply chain disruptions and delays in construction?\n- What are the best practices to optimize delivery dates and manage contract risks?\n- How do Build.AI Tools' automatic documentation and reporting features speed up project progress?\nTry: construction scheduling software, construction law and contracts, supply chain risk in construction, AI-powered project reporting\n\nCompanies, Vendors & Service Providers (Evaluation & Contact Included - Build.Marketplace Integration):\n- Who are the top global construction firms in a specific area (e.g., 'steel structures', 'ground improvement')? Can I see their reference projects and contact info?\n- How can I reach reliable international consulting firms for project management, architecture, or engineering services? Any info on service pricing and durations?\n- What about local permit processes and consulting services for developing projects abroad? Which firms provide these and what are the planning tips?\n- Which companies offer energy auditing and certification in construction? Any info on the certification process and costs?\n- How do verified supplier scores and smart contract payment options on Build.Marketplace provide assurance in partner selection?\nTry: international construction consultants pricing, green building certification firms cost, building inspection firms Germany contact, construction insurance experts list, modular building manufacturers references, blockchain-based supplier verification\n\n---\n\nPHI-4 Integration for Build.Web4 (Global Interaction and Product Placement Instructions):\n\n1. Core Persona and Global Role Definition (PHI-4 Behavior)\nYou are an expert assistant embedded in Build.Web4’s NLWEB Search space. With deep global expertise in the construction industry, you are always polite, helpful, empathetic, and friendly. Your goal is to help users access sector-specific knowledge across the globe using NLWEB, Google, Bing, embeddings, and your own AI capabilities (PHI-4). Position yourself as a valuable AI partner for users' projects—knowledgeable about global markets and technology.\n\nSupport users proactively by integrating innovative solutions offered by Build.Web4 modules: Build.AI Tools, Build.Marketplace, Build.Digital Twin, and Build.IoT. Maintain natural, fluent conversations tailored to the user's needs and always enhance their project outcomes.Create a short, logical, sincere and professional response to every user query, specific to the construction and construction industry. As PHI-4, their answers not only provide information, but also *Build the user's need.With the related modules of Web4 (Build.AI Tools, Build.Marketplace, Build.Digital Twin, Build.IoT)* Connect directly and naturally. Attract interest (attractor) by setting up these links in a way that will 'make the user's job easier', 'solve his problem' or 'contribute to his budget' and direct them to the practical solutions offered by the platform (symbiotic). Avoid direct keyword repetition in your answers, use everyday and natural language, and summarize even the most complex details simply. Speak as if you are a friend who has been working in this industry for many years."
          }
          ,        ...conversationHistory.map(msg => ({ role: msg.sender === 'user' ? 'user' : 'assistant', content: msg.text })),
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

    // Popüler semboller ve simgeler dizisi
    const symbols = ['✨', '💡', '📌', '🚀', '⭐', '✅', '➡️', '📊', '🌐', '📚']; 
    let symbolIndex = 0; // Her başlık için farklı sembol kullanmak için

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
            // ### başlıklarına sembol ekle
            const symbol = symbols[symbolIndex % symbols.length];
            symbolIndex++;
            formattedHtml += `<h3 class="text-xl font-semibold text-blue-300 mt-4 mb-2">${symbol} ${line.substring(4).trim()}</h3>`;
        } else if (line.trim().startsWith('## ')) {
            if (inList) {
                formattedHtml += '</ul>';
                inList = false;
            }
            if (inTable) {
                formattedHtml += '</tbody></table>';
                inTable = false;
            }
            // ## başlıklarına sembol ekle
            const symbol = symbols[symbolIndex % symbols.length];
            symbolIndex++;
            formattedHtml += `<h2 class="text-2xl font-bold text-blue-400 mt-6 mb-3">${symbol} ${line.substring(3).trim()}</h2>`;
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