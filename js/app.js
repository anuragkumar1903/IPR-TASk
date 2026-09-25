// --- Core Navigation & Setup ---
document.addEventListener('DOMContentLoaded', () => {
    // Navigation Logic
    const navBtns = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.view-section');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // API Key Management (Session Storage Only)
    const keyInput = document.getElementById('api-key-input');
    const saveBtn = document.getElementById('save-key-btn');
    const keyStatus = document.getElementById('key-status');

    if(sessionStorage.getItem('gemini_api_key')) {
        keyInput.value = sessionStorage.getItem('gemini_api_key');
        keyStatus.textContent = "Key Loaded in Session";
        keyStatus.className = "status-text text-success";
    }

    saveBtn.addEventListener('click', () => {
        const val = keyInput.value.trim();
        if(val) {
            sessionStorage.setItem('gemini_api_key', val);
            keyStatus.textContent = "Key Saved to Session";
            keyStatus.className = "status-text text-success";
        } else {
            sessionStorage.removeItem('gemini_api_key');
            keyStatus.textContent = "Missing Key";
            keyStatus.className = "status-text text-error";
        }
    });
    
    // Apps Script URL Management (Task 5)
    const sheetsUrlInput = document.getElementById('sheets-url');
    if(sessionStorage.getItem('sheets_url')) {
        sheetsUrlInput.value = sessionStorage.getItem('sheets_url');
    }
    sheetsUrlInput.addEventListener('change', () => {
        sessionStorage.setItem('sheets_url', sheetsUrlInput.value.trim());
    });
});

// --- Centralized API Caller ---
async function callGemini(prompt, errorContainerId = null) {
    const apiKey = sessionStorage.getItem('gemini_api_key');
    const errCont = errorContainerId ? document.getElementById(errorContainerId) : null;
    
    if (errCont) errCont.textContent = ''; // clear previous error

    if (!apiKey) {
        const msg = "Please enter and save your Gemini API Key in the sidebar first!";
        if (errCont) errCont.textContent = msg;
        else alert(msg);
        return null;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            if (response.status === 503) throw new Error("AI model is currently busy. Try again.");
            if (response.status === 429) throw new Error("Too many requests. Please wait a moment and try again.");
            throw new Error(`API Error: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        const msg = (error.message.includes("busy") || error.message.includes("requests")) ? 
            error.message : "Failed to generate: " + error.message;
        
        if (errCont) errCont.textContent = msg;
        else alert(msg);
        
        console.error(error);
        return null;
    }
}

// Helper to parse Strict JSON
function parseStrictJSON(text, errorContainerId = null) {
    try {
        const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(clean);
    } catch (err) {
        const msg = "AI returned invalid format. Please try again.";
        if (errorContainerId) document.getElementById(errorContainerId).textContent = msg;
        else alert(msg);
        console.error("JSON Parse Error:", err, text);
        return null;
    }
}

// Helper to sanitize HTML
function sanitizeHTML(html) {
    return typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(html) : html;
}

// --- 1. Resume Builder ---
document.getElementById('resume-form').addEventListener('submit', async (e) => {
    e.preventDefault(); // Form validation handles required fields natively
    const btn = document.getElementById('btn-resume');
    btn.innerHTML = 'Generating... <i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    
    const name = document.getElementById('res-name').value;
    const contact = document.getElementById('res-contact').value;
    const edu = document.getElementById('res-edu').value;
    const skills = document.getElementById('res-skills').value;
    const exp = document.getElementById('res-exp').value;

    const prompt = `Act as an expert resume writer. Create a professional resume for:
Name: ${name}
Contact: ${contact}
Education: ${edu}
Skills: ${skills}
Experience: ${exp}

Return ONLY raw text formatted elegantly using basic markdown. Do not include extra commentary.`;

    const result = await callGemini(prompt, 'resume-error');
    if(result) {
        const out = document.getElementById('resume-output');
        out.classList.remove('placeholder');
        out.innerHTML = sanitizeHTML(marked.parse(result));
        document.getElementById('btn-print-resume').classList.remove('hidden');
    }
    btn.innerHTML = 'Generate Resume <i class="fas fa-magic"></i>';
    btn.disabled = false;
});

// Resume PDF Download
document.getElementById('btn-print-resume').addEventListener('click', () => {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const content = document.getElementById('resume-output').innerText;
        const lines = doc.splitTextToSize(content, 180);
        doc.text(lines, 10, 10);
        doc.save('resume.pdf');
    } catch (e) {
        window.print(); // Fallback
    }
});


// --- 2. Notes Generator ---
document.getElementById('btn-notes').addEventListener('click', async (e) => {
    const btn = e.target;
    const text = document.getElementById('notes-input').value.trim();
    const errCont = document.getElementById('notes-error');
    errCont.textContent = '';
    
    if(!text) return errCont.textContent = "Please enter text";

    btn.innerHTML = 'Generating... <i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    const prompt = `Convert the following text into short, structured bullet-point notes with clear Markdown headings. Do not include extra conversational text.\n\n${text}`;
    
    const result = await callGemini(prompt, 'notes-error');
    if(result) {
        const out = document.getElementById('notes-output');
        out.classList.remove('placeholder');
        out.innerHTML = sanitizeHTML(marked.parse(result));
        out.dataset.rawNotes = result; // save raw for download/copy
        document.getElementById('notes-actions').classList.remove('hidden');
    }
    btn.innerHTML = 'Generate Notes <i class="fas fa-magic"></i>';
    btn.disabled = false;
});

document.getElementById('btn-copy-notes').addEventListener('click', () => {
    const raw = document.getElementById('notes-output').dataset.rawNotes;
    if(raw) navigator.clipboard.writeText(raw).then(() => alert("Copied to clipboard!"));
});

document.getElementById('btn-download-notes').addEventListener('click', () => {
    const raw = document.getElementById('notes-output').dataset.rawNotes;
    if(raw) {
        const blob = new Blob([raw], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'study_notes.txt';
        a.click();
    }
});


// --- 3. PPT Generator ---
let pptSlides = [];
let pptIndex = 0;

function renderSlide() {
    const slide = pptSlides[pptIndex];
    document.getElementById('ppt-slide').innerHTML = `
        <h2>${sanitizeHTML(slide.title)}</h2>
        <ul>${slide.bullets.map(p => `<li>${sanitizeHTML(p)}</li>`).join('')}</ul>
    `;
    document.getElementById('ppt-counter').textContent = `${pptIndex + 1} / ${pptSlides.length}`;
}

document.getElementById('btn-ppt').addEventListener('click', async (e) => {
    const btn = e.target;
    const topic = document.getElementById('ppt-topic').value.trim();
    const errCont = document.getElementById('ppt-error');
    errCont.textContent = '';
    
    if(!topic) return errCont.textContent = "Please enter a topic";

    btn.innerHTML = 'Generating... <i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    const prompt = `Create a 5-slide presentation on the topic: "${topic}". Return ONLY a strict JSON array of objects. Do not use markdown fences. Schema: [{"title":"String","bullets":["String","String"]}]`;
    
    const result = await callGemini(prompt, 'ppt-error');
    if(result) {
        const slides = parseStrictJSON(result, 'ppt-error');
        if(slides && Array.isArray(slides)) {
            pptSlides = slides;
            pptIndex = 0;
            document.getElementById('ppt-container').classList.remove('hidden');
            renderSlide();
        }
    }
    btn.innerHTML = 'Generate Slides <i class="fas fa-magic"></i>';
    btn.disabled = false;
});

document.getElementById('btn-ppt-prev').addEventListener('click', () => {
    if(pptIndex > 0) { pptIndex--; renderSlide(); }
});
document.getElementById('btn-ppt-next').addEventListener('click', () => {
    if(pptIndex < pptSlides.length - 1) { pptIndex++; renderSlide(); }
});


// --- 4. Mind Map Generator ---
document.getElementById('btn-mindmap').addEventListener('click', async (e) => {
    const btn = e.target;
    const text = document.getElementById('mindmap-input').value.trim();
    const errCont = document.getElementById('mindmap-error');
    errCont.textContent = '';
    
    if(!text) return errCont.textContent = "Please enter syllabus";

    btn.innerHTML = 'Generating... <i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    const prompt = `Convert the following syllabus/topic into a nested outline using Markdown headings (e.g. # Main \n ## Sub \n ### Detail). Return ONLY the raw markdown without code fences:\n\n${text}`;
    
    const result = await callGemini(prompt, 'mindmap-error');
    if(result) {
        document.getElementById('markmap-svg').innerHTML = '';
        try {
            const { markmap } = window;
            const { root } = markmap.Transformer.prototype.transform(result);
            markmap.Markmap.create('#markmap-svg', null, root);
        } catch(err) {
            errCont.textContent = "Failed to render mind map.";
            console.error(err);
        }
    }
    btn.innerHTML = 'Generate Map <i class="fas fa-magic"></i>';
    btn.disabled = false;
});


// --- 5. Sheets Backend ---
document.getElementById('btn-sheet-post').addEventListener('click', async (e) => {
    const btn = e.target;
    const url = document.getElementById('sheets-url').value.trim();
    const name = document.getElementById('sheet-name').value.trim();
    const score = document.getElementById('sheet-score').value.trim();
    const msgDiv = document.getElementById('sheet-post-msg');
    
    if(!url) return msgDiv.textContent = "Please enter Apps Script URL";
    if(!name || !score) return msgDiv.textContent = "Fill out all fields";

    msgDiv.textContent = 'Submitting...';
    btn.disabled = true;

    try {
        // We assume Apps Script deployed to accept POST with JSON or formData. Usually fetch with 'no-cors' for simple apps script POST, but that hides response.
        // For a full fix, Google Apps script needs doPost that returns ContentService.createTextOutput.
        const res = await fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, score })
        });
        msgDiv.textContent = "Submitted successfully!";
        msgDiv.className = "text-success mt-1";
    } catch(err) {
        msgDiv.textContent = "Network Error: " + err.message;
        msgDiv.className = "error-msg mt-1";
    }
    btn.disabled = false;
});

document.getElementById('btn-sheet-get').addEventListener('click', async (e) => {
    const btn = e.target;
    const url = document.getElementById('sheets-url').value.trim();
    const msgDiv = document.getElementById('sheet-get-msg');
    const tbody = document.querySelector('#sheet-table tbody');
    
    if(!url) return msgDiv.textContent = "Please enter Apps Script URL";

    msgDiv.textContent = 'Loading...';
    btn.disabled = true;

    try {
        const res = await fetch(url);
        if(!res.ok) throw new Error("HTTP error " + res.status);
        const data = await res.json();
        
        tbody.innerHTML = '';
        if(Array.isArray(data)) {
            data.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${sanitizeHTML(row.name || '')}</td><td>${sanitizeHTML(row.score || '')}</td>`;
                tbody.appendChild(tr);
            });
            msgDiv.textContent = `Loaded ${data.length} rows.`;
            msgDiv.className = "text-success mt-1";
        }
    } catch(err) {
        msgDiv.textContent = "Error fetching data. Check CORS and URL. " + err.message;
        msgDiv.className = "error-msg mt-1";
    }
    btn.disabled = false;
});

document.getElementById('btn-sheet-insight').addEventListener('click', async (e) => {
    const btn = e.target;
    const rows = document.querySelectorAll('#sheet-table tbody tr');
    if(rows.length === 0) return alert("Please Load Data first.");
    
    let csv = "Name,Score\n";
    rows.forEach(r => csv += `${r.cells[0].innerText},${r.cells[1].innerText}\n`);

    btn.innerHTML = 'Generating Insight... <i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    
    const prompt = `Analyze this student data and give a 2-sentence insight:\n\n${csv}`;
    const result = await callGemini(prompt);
    
    if(result) {
        const out = document.getElementById('sheet-insight-output');
        out.classList.remove('placeholder');
        out.innerHTML = sanitizeHTML(marked.parse(result));
    }
    btn.innerHTML = 'Generate AI Insight';
    btn.disabled = false;
});


// --- 6. AI Quiz Generator ---
let quizData = [];
let quizIndex = 0;
let quizScore = 0;

function renderQuizQuestion() {
    if(quizIndex >= quizData.length) {
        document.getElementById('quiz-play').classList.add('hidden');
        document.getElementById('quiz-result').classList.remove('hidden');
        document.getElementById('quiz-final-score').textContent = `You scored ${quizScore} out of ${quizData.length}!`;
        return;
    }
    
    const q = quizData[quizIndex];
    document.getElementById('quiz-question').textContent = `${quizIndex + 1}. ${q.question}`;
    const opts = document.getElementById('quiz-options');
    opts.innerHTML = '';
    
    q.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option';
        btn.textContent = opt;
        btn.onclick = () => handleQuizAnswer(btn, opt, q.answer);
        opts.appendChild(btn);
    });
    
    document.getElementById('btn-quiz-next').classList.add('hidden');
}

function handleQuizAnswer(btn, selected, correct) {
    const opts = document.querySelectorAll('.quiz-option');
    opts.forEach(b => b.disabled = true);
    
    if(selected === correct) {
        btn.classList.add('correct');
        quizScore++;
        document.getElementById('quiz-score-display').textContent = `Score: ${quizScore}`;
    } else {
        btn.classList.add('wrong');
        // highlight correct
        opts.forEach(b => { if(b.textContent === correct) b.classList.add('correct'); });
    }
    document.getElementById('btn-quiz-next').classList.remove('hidden');
}

document.getElementById('btn-quiz-gen').addEventListener('click', async (e) => {
    const btn = e.target;
    const topic = document.getElementById('quiz-topic').value.trim();
    const errCont = document.getElementById('quiz-error');
    errCont.textContent = '';
    
    if(!topic) return errCont.textContent = "Enter a topic.";

    btn.innerHTML = 'Generating... <i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    
    const prompt = `Generate a 5-question multiple choice quiz on: "${topic}". Return ONLY strict JSON. Schema: [{"question":"String","options":["A","B","C","D"],"answer":"A"}]`;
    const result = await callGemini(prompt, 'quiz-error');
    
    if(result) {
        const data = parseStrictJSON(result, 'quiz-error');
        if(data && Array.isArray(data)) {
            quizData = data;
            quizIndex = 0;
            quizScore = 0;
            document.getElementById('quiz-score-display').textContent = `Score: 0`;
            document.getElementById('quiz-setup').classList.add('hidden');
            document.getElementById('quiz-play').classList.remove('hidden');
            renderQuizQuestion();
        }
    }
    btn.innerHTML = 'Generate Quiz';
    btn.disabled = false;
});

document.getElementById('btn-quiz-next').addEventListener('click', () => {
    quizIndex++;
    renderQuizQuestion();
});
document.getElementById('btn-quiz-restart').addEventListener('click', () => {
    document.getElementById('quiz-result').classList.add('hidden');
    document.getElementById('quiz-setup').classList.remove('hidden');
});


// --- 7. Chatbot ---
let chatHistory = [];
document.getElementById('btn-chat').addEventListener('click', async () => {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if(!msg) return;

    const out = document.getElementById('chat-history');
    
    const userDiv = document.createElement('div');
    userDiv.className = 'chat-bubble user';
    userDiv.textContent = msg;
    out.appendChild(userDiv);
    input.value = '';
    out.scrollTop = out.scrollHeight;

    chatHistory.push(`User: ${msg}`);
    const prompt = `You are a helpful tutor. History:\n${chatHistory.join('\n')}\nAI:`;
    
    const result = await callGemini(prompt);
    if(result) {
        chatHistory.push(`AI: ${result}`);
        const aiDiv = document.createElement('div');
        aiDiv.className = 'chat-bubble ai';
        aiDiv.innerHTML = sanitizeHTML(marked.parse(result));
        out.appendChild(aiDiv);
        out.scrollTop = out.scrollHeight;
    }
});
document.getElementById('btn-chat-clear').addEventListener('click', () => {
    chatHistory = [];
    document.getElementById('chat-history').innerHTML = '<div class="chat-bubble ai">Hello! I am your AI tutor. Ask me any doubt. (History cleared)</div>';
});


// --- 8. Flashcards ---
let flashcardDeck = [];

function renderFlashcards() {
    const out = document.getElementById('flashcards-output');
    out.innerHTML = '';
    out.classList.remove('placeholder');
    
    flashcardDeck.forEach(c => {
        const container = document.createElement('div');
        container.className = 'flashcard-container';
        
        const card = document.createElement('div');
        card.className = 'flashcard';
        
        const front = document.createElement('div');
        front.className = 'flashcard-front';
        front.innerHTML = sanitizeHTML(c.question);
        
        const back = document.createElement('div');
        back.className = 'flashcard-back';
        back.innerHTML = sanitizeHTML(c.answer);
        
        card.appendChild(front);
        card.appendChild(back);
        container.appendChild(card);
        
        container.addEventListener('click', () => card.classList.toggle('flipped'));
        out.appendChild(container);
    });
}

document.getElementById('btn-flashcards').addEventListener('click', async (e) => {
    const btn = e.target;
    const topic = document.getElementById('flashcard-topic').value.trim();
    const errCont = document.getElementById('flashcards-error');
    errCont.textContent = '';
    
    if(!topic) return errCont.textContent = "Please enter a topic";

    btn.innerHTML = 'Generating... <i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    const prompt = `Generate 6 question-answer flashcards based on this topic: "${topic}". Return ONLY strict JSON. Schema: [{"question":"String","answer":"String"}]`;
    
    const result = await callGemini(prompt, 'flashcards-error');
    if(result) {
        const data = parseStrictJSON(result, 'flashcards-error');
        if(data && Array.isArray(data)) {
            flashcardDeck = data;
            renderFlashcards();
            document.getElementById('btn-flashcards-shuffle').classList.remove('hidden');
        }
    }
    btn.innerHTML = 'Generate Deck <i class="fas fa-magic"></i>';
    btn.disabled = false;
});

document.getElementById('btn-flashcards-shuffle').addEventListener('click', () => {
    if(flashcardDeck.length > 0) {
        flashcardDeck.sort(() => Math.random() - 0.5);
        renderFlashcards();
    }
});


// --- 9. Study Planner ---
function getSubjectColor(subject) {
    let hash = 0;
    for (let i = 0; i < subject.length; i++) hash = subject.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${hash % 360}, 70%, 80%)`;
}

document.getElementById('btn-planner').addEventListener('click', async (e) => {
    const btn = e.target;
    const sub = document.getElementById('plan-subjects').value.trim();
    const hours = document.getElementById('plan-hours').value.trim();
    const days = document.getElementById('plan-days').value.trim();
    const errCont = document.getElementById('planner-error');
    errCont.textContent = '';
    
    if(!sub || !hours || !days) return errCont.textContent = "Fill out all fields";

    btn.innerHTML = 'Generating... <i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    const prompt = `Create a study timetable for ${days} days, focusing on subjects: ${sub}, studying ${hours} hours per day. Return ONLY strict JSON. Schema: [{"day":"Day 1","slots":[{"time":"9am-11am","subject":"Math"}]}]`;
    
    const result = await callGemini(prompt, 'planner-error');
    if(result) {
        const data = parseStrictJSON(result, 'planner-error');
        if(data && Array.isArray(data)) {
            const out = document.getElementById('planner-output');
            out.classList.remove('placeholder');
            
            let html = `<table><thead><tr><th>Day</th><th>Time</th><th>Subject</th></tr></thead><tbody>`;
            data.forEach(d => {
                if(d.slots && Array.isArray(d.slots)) {
                    d.slots.forEach((s, idx) => {
                        html += `<tr>
                            ${idx === 0 ? `<td rowspan="${d.slots.length}"><strong>${sanitizeHTML(d.day)}</strong></td>` : ''}
                            <td>${sanitizeHTML(s.time)}</td>
                            <td><span class="subject-pill" style="background:${getSubjectColor(s.subject)}">${sanitizeHTML(s.subject)}</span></td>
                        </tr>`;
                    });
                }
            });
            html += `</tbody></table>`;
            out.innerHTML = html;
        }
    }
    btn.innerHTML = 'Generate Plan <i class="fas fa-magic"></i>';
    btn.disabled = false;
});


// --- 10. OCR Summarizer ---
document.getElementById('btn-ocr').addEventListener('click', async (e) => {
    const btn = e.target;
    const fileInput = document.getElementById('ocr-image');
    const errCont = document.getElementById('ocr-error');
    errCont.textContent = '';
    
    if(!fileInput.files.length) return errCont.textContent = "Please upload an image first.";

    btn.innerHTML = 'Extracting... <i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    
    const file = fileInput.files[0];
    const imageURL = URL.createObjectURL(file);

    try {
        const worker = await Tesseract.createWorker('eng');
        const ret = await worker.recognize(imageURL);
        const extractedText = ret.data.text;
        await worker.terminate();

        const rawDiv = document.getElementById('ocr-raw');
        rawDiv.classList.remove('placeholder');
        rawDiv.value = extractedText;

        if(extractedText.trim().length > 0) {
            document.getElementById('btn-ocr-resummarize').classList.remove('hidden');
            await doOCRSurmarize(extractedText);
        } else {
            errCont.textContent = "No text found in image.";
        }
    } catch(err) {
        console.error(err);
        errCont.textContent = "OCR Failed: " + err.message;
    }
    btn.innerHTML = 'Extract & Summarize <i class="fas fa-magic"></i>';
    btn.disabled = false;
});

document.getElementById('btn-ocr-resummarize').addEventListener('click', async (e) => {
    const btn = e.target;
    const text = document.getElementById('ocr-raw').value.trim();
    if(!text) return;
    
    btn.disabled = true;
    btn.innerHTML = 'Summarizing...';
    await doOCRSurmarize(text);
    btn.disabled = false;
    btn.innerHTML = 'Re-Summarize Edits';
});

async function doOCRSurmarize(text) {
    const prompt = `Summarize the following OCR extracted text into 3-4 key bullet points. Do not include extra conversational text:\n\n${text}`;
    const result = await callGemini(prompt, 'ocr-error');
    if(result) {
        const sumDiv = document.getElementById('ocr-summary');
        sumDiv.classList.remove('placeholder');
        sumDiv.innerHTML = sanitizeHTML(marked.parse(result));
    }
}
