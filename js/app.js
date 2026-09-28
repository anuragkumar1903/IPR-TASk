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
// options.system  -> system instruction text
// options.history -> full multi-turn contents array (used instead of prompt)
// options.json    -> ask Gemini to respond with application/json
async function callGemini(prompt, errorContainerId = null, options = {}) {
    const apiKey = sessionStorage.getItem('gemini_api_key');
    const errCont = errorContainerId ? document.getElementById(errorContainerId) : null;

    if (errCont) errCont.textContent = ''; // clear previous error

    if (!apiKey) {
        const msg = "Please enter and save your Gemini API Key in the sidebar first!";
        if (errCont) errCont.textContent = msg;
        else alert(msg);
        return null;
    }

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent';
    const body = {
        contents: options.history || [{ role: 'user', parts: [{ text: prompt }] }]
    };
    if (options.system) body.systemInstruction = { parts: [{ text: options.system }] };
    if (options.json) body.generationConfig = { responseMimeType: 'application/json' };

    try {
        const response = await fetch(url, {
            method: 'POST',
            // Key goes in a header rather than the URL so it doesn't end up in logs/history
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            if (response.status === 503) throw new Error("AI model is currently busy. Try again.");
            if (response.status === 429) throw new Error("Too many requests. Please wait a moment and try again.");
            let detail = response.statusText;
            try { detail = (await response.json()).error.message || detail; } catch (_) {}
            throw new Error(`API Error: ${response.status} - ${detail}`);
        }

        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts;
        if (!parts || !parts.length) throw new Error("AI returned an empty response (it may have been blocked). Try rephrasing.");
        return parts.map(p => p.text || '').join('');
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
        showError(errorContainerId, "AI returned invalid format. Please try again.");
        console.error("JSON Parse Error:", err, text);
        return null;
    }
}

function showError(errorContainerId, msg) {
    if (errorContainerId) document.getElementById(errorContainerId).textContent = msg;
    else alert(msg);
}

// Helper to sanitize HTML
function sanitizeHTML(html) {
    return typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(html) : html;
}

// Helper to escape plain text before putting it into an HTML string
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
}

// Button loading state. Uses the button's own HTML so labels/icons are restored exactly.
function setBusy(btn, busy, label = 'Generating...') {
    if (busy) {
        btn.dataset.label = btn.innerHTML;
        btn.innerHTML = `${label} <i class="fas fa-spinner fa-spin"></i>`;
        btn.disabled = true;
    } else {
        if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
        btn.disabled = false;
    }
}

// Multi-page text PDF export (jsPDF), falls back to the browser print dialog
function saveTextAsPDF(text, filename) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFontSize(11);
        const lines = doc.splitTextToSize(text, 180);
        const lineHeight = 6;
        const bottom = doc.internal.pageSize.getHeight() - 15;
        let y = 15;
        lines.forEach(line => {
            if (y > bottom) { doc.addPage(); y = 15; }
            doc.text(line, 15, y);
            y += lineHeight;
        });
        doc.save(filename);
    } catch (e) {
        console.error(e);
        window.print(); // Fallback
    }
}

// --- 1. Resume Builder ---
const SAMPLE_PROFILES = [
    {
        name: 'Priya Sharma', contact: 'priya.sharma@example.com | +91 98765 43210',
        objective: 'Final-year CS student seeking a frontend developer internship to build accessible, fast web apps.',
        edu: 'B.Tech Computer Science, ABC Institute of Technology (2022-2026), CGPA 8.7',
        skills: 'HTML, CSS, JavaScript, React, Git, Figma',
        exp: 'Built a college event portal used by 2,000+ students (React). Web team lead, college tech fest 2025.'
    },
    {
        name: 'Rahul Verma', contact: 'rahul.verma@example.com | +91 91234 56789',
        objective: 'Aspiring data analyst eager to turn raw data into clear business insights.',
        edu: 'B.Sc Statistics, XYZ University (2021-2024), 78%',
        skills: 'Python, Pandas, SQL, Excel, Power BI, Statistics',
        exp: 'Data analytics intern at a retail startup (3 months): automated weekly sales reports, cutting prep time by 60%.'
    },
    {
        name: 'Aisha Khan', contact: 'aisha.khan@example.com | +91 99887 66554',
        objective: 'Commerce graduate looking for an entry-level digital marketing role.',
        edu: 'B.Com, PQR College (2020-2023), First Division',
        skills: 'SEO, Google Ads, Canva, Social Media Marketing, Content Writing',
        exp: 'Grew an Instagram page for a local bakery from 500 to 8,000 followers in 6 months. Freelance blog writer.'
    }
];
let sampleIndex = 0;

document.getElementById('btn-resume-sample').addEventListener('click', () => {
    const p = SAMPLE_PROFILES[sampleIndex];
    sampleIndex = (sampleIndex + 1) % SAMPLE_PROFILES.length;
    document.getElementById('res-name').value = p.name;
    document.getElementById('res-contact').value = p.contact;
    document.getElementById('res-objective').value = p.objective;
    document.getElementById('res-edu').value = p.edu;
    document.getElementById('res-skills').value = p.skills;
    document.getElementById('res-exp').value = p.exp;
});

document.getElementById('resume-form').addEventListener('submit', async (e) => {
    e.preventDefault(); // Form validation handles required fields natively
    const btn = document.getElementById('btn-resume');
    setBusy(btn, true);

    const name = document.getElementById('res-name').value;
    const contact = document.getElementById('res-contact').value;
    const objective = document.getElementById('res-objective').value;
    const edu = document.getElementById('res-edu').value;
    const skills = document.getElementById('res-skills').value;
    const exp = document.getElementById('res-exp').value;

    const prompt = `Act as an expert resume writer. Create a professional resume for:
Name: ${name}
Contact: ${contact}
Objective: ${objective}
Education: ${edu}
Skills: ${skills}
Experience: ${exp}

Use sections: Objective, Education, Skills, Experience/Projects. Return ONLY raw text formatted elegantly using basic markdown. Do not include extra commentary.`;

    const result = await callGemini(prompt, 'resume-error');
    if(result) {
        const out = document.getElementById('resume-output');
        out.classList.remove('placeholder');
        out.classList.add('markdown-body');
        out.innerHTML = sanitizeHTML(marked.parse(result));
        document.getElementById('btn-print-resume').classList.remove('hidden');
    }
    setBusy(btn, false);
});

// Resume PDF Download
document.getElementById('btn-print-resume').addEventListener('click', () => {
    saveTextAsPDF(document.getElementById('resume-output').innerText, 'resume.pdf');
});


// --- 2. Notes Generator ---
document.getElementById('btn-notes').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const text = document.getElementById('notes-input').value.trim();
    const errCont = document.getElementById('notes-error');
    errCont.textContent = '';

    if(!text) return errCont.textContent = "Please enter text";

    setBusy(btn, true);
    const prompt = `Convert the following text into short, structured bullet-point notes with clear Markdown headings. Do not include extra conversational text.\n\n${text}`;

    const result = await callGemini(prompt, 'notes-error');
    if(result) {
        const out = document.getElementById('notes-output');
        out.classList.remove('placeholder');
        out.innerHTML = sanitizeHTML(marked.parse(result));
        out.dataset.rawNotes = result; // save raw for download/copy
        document.getElementById('notes-actions').classList.remove('hidden');
    }
    setBusy(btn, false);
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
        URL.revokeObjectURL(a.href);
    }
});

document.getElementById('btn-download-notes-pdf').addEventListener('click', () => {
    const out = document.getElementById('notes-output');
    if(out.dataset.rawNotes) saveTextAsPDF(out.innerText, 'study_notes.pdf');
});


// --- 3. PPT Generator ---
let pptSlides = [];
let pptIndex = 0;
let pptTopic = '';

function renderSlide() {
    const slide = pptSlides[pptIndex];
    document.getElementById('ppt-slide').innerHTML = `
        <h2>${escapeHTML(slide.title)}</h2>
        <ul>${slide.bullets.map(p => `<li>${escapeHTML(p)}</li>`).join('')}</ul>
    `;
    document.getElementById('ppt-counter').textContent = `${pptIndex + 1} / ${pptSlides.length}`;
    document.getElementById('btn-ppt-prev').disabled = pptIndex === 0;
    document.getElementById('btn-ppt-next').disabled = pptIndex === pptSlides.length - 1;
}

document.getElementById('btn-ppt').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const topic = document.getElementById('ppt-topic').value.trim();
    const errCont = document.getElementById('ppt-error');
    errCont.textContent = '';

    if(!topic) return errCont.textContent = "Please enter a topic";

    setBusy(btn, true);
    const prompt = `Create a presentation of 5 to 6 slides on the topic: "${topic}". Each slide has a short title and 3 to 4 concise bullet points. Return ONLY a strict JSON array of objects. Schema: [{"title":"String","bullets":["String","String","String"]}]`;

    const result = await callGemini(prompt, 'ppt-error', { json: true });
    if(result) {
        const slides = parseStrictJSON(result, 'ppt-error');
        const valid = Array.isArray(slides)
            ? slides.filter(s => s && typeof s.title === 'string' && Array.isArray(s.bullets))
            : [];
        if(valid.length) {
            pptSlides = valid;
            pptIndex = 0;
            pptTopic = topic;
            document.getElementById('ppt-container').classList.remove('hidden');
            document.getElementById('ppt-actions').classList.remove('hidden');
            renderSlide();
        } else if(slides) {
            errCont.textContent = "AI returned slides in an unexpected shape. Please try again.";
        }
    }
    setBusy(btn, false);
});

document.getElementById('btn-ppt-prev').addEventListener('click', () => {
    if(pptIndex > 0) { pptIndex--; renderSlide(); }
});
document.getElementById('btn-ppt-next').addEventListener('click', () => {
    if(pptIndex < pptSlides.length - 1) { pptIndex++; renderSlide(); }
});

// Arrow-key navigation while the PPT view is open
document.addEventListener('keydown', (e) => {
    if(!document.getElementById('ppt').classList.contains('active') || !pptSlides.length) return;
    if(['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if(e.key === 'ArrowLeft') document.getElementById('btn-ppt-prev').click();
    if(e.key === 'ArrowRight') document.getElementById('btn-ppt-next').click();
});

document.getElementById('btn-ppt-export').addEventListener('click', () => {
    if(typeof PptxGenJS === 'undefined') return alert("PPTX library failed to load. Check your internet connection.");
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    pptSlides.forEach(s => {
        const slide = pptx.addSlide();
        slide.addText(s.title, { x: 0.5, y: 0.3, w: 9, h: 1, fontSize: 28, bold: true, color: '1A73E8' });
        slide.addText(
            s.bullets.map(b => ({ text: String(b), options: { bullet: true, breakLine: true } })),
            { x: 0.5, y: 1.4, w: 9, h: 3.8, fontSize: 18, color: '202124', valign: 'top' }
        );
    });
    const safeName = pptTopic.replace(/[^\w\- ]+/g, '').trim().slice(0, 50) || 'presentation';
    pptx.writeFile({ fileName: `${safeName}.pptx` });
});


// --- 4. Mind Map Generator ---
let mindmapInstance = null;
let mindmapTopic = '';

document.getElementById('btn-mindmap').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const text = document.getElementById('mindmap-input').value.trim();
    const errCont = document.getElementById('mindmap-error');
    errCont.textContent = '';

    if(!text) return errCont.textContent = "Please enter syllabus";

    setBusy(btn, true);
    const prompt = `Convert the following syllabus/topic into a nested outline using Markdown headings: one "#" main topic, "##" for each unit/sub-topic, and "###" or "-" bullets for key points. Return ONLY the raw markdown without code fences:\n\n${text}`;

    const result = await callGemini(prompt, 'mindmap-error');
    if(result) {
        try {
            const md = result.replace(/```(markdown|md)?\n?/g, '').trim();
            const { markmap } = window;
            const { root } = new markmap.Transformer().transform(md);
            // markmap colors each branch (unit) differently by default; reuse the instance on regenerate
            if(mindmapInstance) {
                mindmapInstance.setData(root);
                mindmapInstance.fit();
            } else {
                mindmapInstance = markmap.Markmap.create('#markmap-svg', { duration: 300 }, root);
            }
            mindmapTopic = (md.match(/^#\s+(.+)$/m) || [, text.slice(0, 80)])[1];
            const detail = document.getElementById('mindmap-detail');
            detail.classList.add('placeholder');
            detail.textContent = 'Click a topic in the map to see more detail...';
        } catch(err) {
            errCont.textContent = "Failed to render mind map.";
            console.error(err);
        }
    }
    setBusy(btn, false);
});

// Click a node's label to get extra AI-generated detail (circle clicks still fold/unfold)
document.getElementById('markmap-svg').addEventListener('click', async (e) => {
    const label = e.target.closest('foreignObject');
    if(!label || !mindmapInstance) return;
    const nodeText = label.textContent.trim();
    if(!nodeText) return;

    const detail = document.getElementById('mindmap-detail');
    detail.classList.remove('placeholder');
    detail.innerHTML = `<p><em>Loading detail for "${escapeHTML(nodeText)}"... <i class="fas fa-spinner fa-spin"></i></em></p>`;

    const prompt = `In the context of the syllabus topic "${mindmapTopic}", explain "${nodeText}" for a student in 4-6 short bullet points with one simple example. Use Markdown with a "### ${nodeText}" heading. No extra commentary.`;
    const result = await callGemini(prompt, 'mindmap-error');
    detail.innerHTML = result
        ? sanitizeHTML(marked.parse(result))
        : `<p>Could not load detail for "${escapeHTML(nodeText)}".</p>`;
});


// --- 5. Sheets Backend ---
async function loadSheetData() {
    const url = document.getElementById('sheets-url').value.trim();
    const msgDiv = document.getElementById('sheet-get-msg');
    const tbody = document.querySelector('#sheet-table tbody');

    if(!url) {
        msgDiv.textContent = "Please enter Apps Script URL";
        msgDiv.className = "error-msg mt-1";
        return;
    }

    msgDiv.textContent = 'Loading...';
    msgDiv.className = "mt-1";

    try {
        const res = await fetch(url);
        if(!res.ok) throw new Error("HTTP error " + res.status);
        const json = await res.json();
        const data = Array.isArray(json) ? json : json.data;
        if(!Array.isArray(data)) throw new Error("Expected a JSON array of {name, score} rows");

        tbody.innerHTML = '';
        data.forEach(row => {
            const tr = document.createElement('tr');
            [row.name, row.score].forEach(val => {
                const td = document.createElement('td');
                td.textContent = val ?? '';
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        msgDiv.textContent = `Loaded ${data.length} rows.`;
        msgDiv.className = "text-success mt-1";
    } catch(err) {
        msgDiv.textContent = "Error fetching data. Check the URL and that the Web App is deployed with access 'Anyone'. " + err.message;
        msgDiv.className = "error-msg mt-1";
    }
}

document.getElementById('btn-sheet-post').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const url = document.getElementById('sheets-url').value.trim();
    const name = document.getElementById('sheet-name').value.trim();
    const score = document.getElementById('sheet-score').value.trim();
    const msgDiv = document.getElementById('sheet-post-msg');
    msgDiv.className = "error-msg mt-1";

    if(!url) return msgDiv.textContent = "Please enter Apps Script URL";
    if(!name || !score) return msgDiv.textContent = "Fill out all fields";

    msgDiv.textContent = 'Submitting...';
    msgDiv.className = "mt-1";
    btn.disabled = true;

    try {
        // text/plain keeps this a "simple" CORS request (no preflight, which Apps Script can't answer),
        // so we can still read the JSON reply. doPost parses e.postData.contents.
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ name, score })
        });
        if(!res.ok) throw new Error("HTTP error " + res.status);
        const reply = await res.json();
        if(reply.status !== 'ok') throw new Error(reply.message || 'Sheet rejected the row');

        msgDiv.textContent = "Submitted successfully!";
        msgDiv.className = "text-success mt-1";
        document.getElementById('sheet-name').value = '';
        document.getElementById('sheet-score').value = '';
        await loadSheetData();
    } catch(err) {
        msgDiv.textContent = "Submit failed: " + err.message;
        msgDiv.className = "error-msg mt-1";
    }
    btn.disabled = false;
});

document.getElementById('btn-sheet-get').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    await loadSheetData();
    btn.disabled = false;
});

document.getElementById('btn-sheet-insight').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const rows = document.querySelectorAll('#sheet-table tbody tr');
    if(rows.length === 0) return alert("Please Load Data first.");

    let csv = "Name,Score\n";
    rows.forEach(r => csv += `${r.cells[0].innerText},${r.cells[1].innerText}\n`);

    setBusy(btn, true, 'Generating Insight...');

    const prompt = `Analyze this student data and give a short summary with 2-3 insights or trends (e.g. average, top performers, who needs support):\n\n${csv}`;
    const result = await callGemini(prompt);

    if(result) {
        const out = document.getElementById('sheet-insight-output');
        out.classList.remove('placeholder');
        out.innerHTML = sanitizeHTML(marked.parse(result));
    }
    setBusy(btn, false);
});


// --- 6. AI Quiz Generator ---
let quizData = [];
let quizIndex = 0;
let quizScore = 0;

// Work out which option is correct, tolerating "B", "B) text", an index, or the option text itself
function resolveAnswerIndex(q) {
    const answer = String(q.answer ?? '').trim();
    const norm = s => String(s).trim().toLowerCase();
    let idx = q.options.findIndex(o => norm(o) === norm(answer));
    if(idx >= 0) return idx;
    if(/^\d+$/.test(answer) && +answer < q.options.length) return +answer;
    const letter = answer.match(/^([A-Da-d])(?:[\).:\s]|$)/);
    if(letter) return letter[1].toUpperCase().charCodeAt(0) - 65;
    return q.options.findIndex(o => norm(o).includes(norm(answer)) || norm(answer).includes(norm(o)));
}

function renderQuizQuestion() {
    if(quizIndex >= quizData.length) {
        document.getElementById('quiz-play').classList.add('hidden');
        document.getElementById('quiz-result').classList.remove('hidden');
        const pct = Math.round((quizScore / quizData.length) * 100);
        document.getElementById('quiz-final-score').textContent = `You scored ${quizScore} out of ${quizData.length} (${pct}%)!`;
        return;
    }

    const q = quizData[quizIndex];
    document.getElementById('quiz-question').textContent = `${quizIndex + 1}. ${q.question}`;
    const opts = document.getElementById('quiz-options');
    opts.innerHTML = '';

    q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option';
        btn.textContent = opt;
        btn.onclick = () => handleQuizAnswer(i, q.correctIndex);
        opts.appendChild(btn);
    });

    const nextBtn = document.getElementById('btn-quiz-next');
    nextBtn.textContent = quizIndex === quizData.length - 1 ? 'See Results' : 'Next Question';
    nextBtn.classList.add('hidden');
}

function handleQuizAnswer(selectedIndex, correctIndex) {
    const opts = document.querySelectorAll('.quiz-option');
    opts.forEach(b => b.disabled = true);

    if(selectedIndex === correctIndex) {
        quizScore++;
        document.getElementById('quiz-score-display').textContent = `Score: ${quizScore} / ${quizData.length}`;
    } else {
        opts[selectedIndex].classList.add('wrong');
    }
    opts[correctIndex].classList.add('correct');
    document.getElementById('btn-quiz-next').classList.remove('hidden');
}

document.getElementById('btn-quiz-gen').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const topic = document.getElementById('quiz-topic').value.trim();
    const count = Math.min(10, Math.max(5, parseInt(document.getElementById('quiz-count').value, 10) || 5));
    const errCont = document.getElementById('quiz-error');
    errCont.textContent = '';

    if(!topic) return errCont.textContent = "Enter a topic or paste notes.";

    setBusy(btn, true);

    const prompt = `Generate a ${count}-question multiple choice quiz based on the following topic or notes. Each question has exactly 4 options and one correct answer. "answer" must be copied exactly from one of the options. Return ONLY strict JSON. Schema: [{"question":"String","options":["String","String","String","String"],"answer":"String"}]\n\nTopic / notes:\n${topic}`;
    const result = await callGemini(prompt, 'quiz-error', { json: true });

    if(result) {
        const data = parseStrictJSON(result, 'quiz-error');
        const valid = (Array.isArray(data) ? data : [])
            .filter(q => q && q.question && Array.isArray(q.options) && q.options.length >= 2)
            .map(q => ({ ...q, correctIndex: resolveAnswerIndex(q) }))
            .filter(q => q.correctIndex >= 0 && q.correctIndex < q.options.length);
        if(valid.length) {
            quizData = valid;
            quizIndex = 0;
            quizScore = 0;
            document.getElementById('quiz-score-display').textContent = `Score: 0 / ${quizData.length}`;
            document.getElementById('quiz-setup').classList.add('hidden');
            document.getElementById('quiz-play').classList.remove('hidden');
            renderQuizQuestion();
        } else if(data) {
            errCont.textContent = "AI returned questions in an unexpected shape. Please try again.";
        }
    }
    setBusy(btn, false);
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
const CHAT_GREETING = 'Hello! I am your AI tutor. Set a subject above and ask me any doubt.';
let chatHistory = []; // Gemini multi-turn contents: [{role:'user'|'model', parts:[{text}]}]

function addChatBubble(role, content, isMarkdown = false) {
    const out = document.getElementById('chat-history');
    const div = document.createElement('div');
    div.className = `chat-bubble ${role}`;
    if(isMarkdown) div.innerHTML = sanitizeHTML(marked.parse(content));
    else div.textContent = content;
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
    return div;
}

async function sendChat() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('btn-chat');
    const msg = input.value.trim();
    if(!msg || sendBtn.disabled) return;

    addChatBubble('user', msg);
    input.value = '';
    sendBtn.disabled = true;
    const typing = addChatBubble('ai typing', 'Thinking...');

    const subject = document.getElementById('chat-subject').value.trim() || 'any school subject';
    const system = `You are a helpful tutor for ${subject}. Explain simply with examples. Keep answers short and student-friendly.`;
    chatHistory.push({ role: 'user', parts: [{ text: msg }] });

    const result = await callGemini(null, 'chat-error', { system, history: chatHistory });
    typing.remove();
    if(result) {
        chatHistory.push({ role: 'model', parts: [{ text: result }] });
        addChatBubble('ai', result, true);
    } else {
        chatHistory.pop(); // keep history consistent so the user can retry
    }
    sendBtn.disabled = false;
    input.focus();
}

document.getElementById('btn-chat').addEventListener('click', sendChat);
document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if(e.key === 'Enter') sendChat();
});
document.getElementById('btn-chat-clear').addEventListener('click', () => {
    chatHistory = [];
    document.getElementById('chat-error').textContent = '';
    document.getElementById('chat-history').innerHTML = '';
    addChatBubble('ai', CHAT_GREETING + ' (History cleared)');
});


// --- 8. Flashcards ---
let flashcardDeck = [];
let flashcardIndex = 0;

function renderFlashcard() {
    const c = flashcardDeck[flashcardIndex];
    const cardEl = document.querySelector('#flashcard-card .flashcard');
    cardEl.classList.remove('flipped');
    cardEl.querySelector('.flashcard-front').textContent = c.question;
    cardEl.querySelector('.flashcard-back').textContent = c.answer;
    document.getElementById('flashcards-counter').textContent = `${flashcardIndex + 1} / ${flashcardDeck.length}`;
}

function shuffleInPlace(arr) {
    for(let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

document.getElementById('btn-flashcards').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const topic = document.getElementById('flashcard-topic').value.trim();
    const errCont = document.getElementById('flashcards-error');
    errCont.textContent = '';

    if(!topic) return errCont.textContent = "Please enter a topic";

    setBusy(btn, true);
    const prompt = `Generate 8 to 10 question-answer flashcards for quick revision based on this topic or text. Keep answers brief (1-2 sentences). Return ONLY strict JSON. Schema: [{"question":"String","answer":"String"}]\n\n${topic}`;

    const result = await callGemini(prompt, 'flashcards-error', { json: true });
    if(result) {
        const data = parseStrictJSON(result, 'flashcards-error');
        const valid = (Array.isArray(data) ? data : []).filter(c => c && c.question && c.answer);
        if(valid.length) {
            flashcardDeck = valid;
            flashcardIndex = 0;
            document.getElementById('flashcards-placeholder').classList.add('hidden');
            document.getElementById('flashcards-deck').classList.remove('hidden');
            renderFlashcard();
        } else if(data) {
            errCont.textContent = "AI returned cards in an unexpected shape. Please try again.";
        }
    }
    setBusy(btn, false);
});

const flashcardEl = document.getElementById('flashcard-card');
flashcardEl.addEventListener('click', () => flashcardEl.querySelector('.flashcard').classList.toggle('flipped'));
flashcardEl.addEventListener('keydown', (e) => {
    if(e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        flashcardEl.click();
    }
});

document.getElementById('btn-flashcards-next').addEventListener('click', () => {
    if(!flashcardDeck.length) return;
    flashcardIndex = (flashcardIndex + 1) % flashcardDeck.length;
    renderFlashcard();
});
document.getElementById('btn-flashcards-prev').addEventListener('click', () => {
    if(!flashcardDeck.length) return;
    flashcardIndex = (flashcardIndex - 1 + flashcardDeck.length) % flashcardDeck.length;
    renderFlashcard();
});
document.getElementById('btn-flashcards-shuffle').addEventListener('click', () => {
    if(!flashcardDeck.length) return;
    shuffleInPlace(flashcardDeck);
    flashcardIndex = 0;
    renderFlashcard();
});


// --- 9. Study Planner ---
const MAX_PLAN_DAYS = 14;
let lastPlan = null;

function getSubjectColor(subject) {
    let hash = 0;
    const key = String(subject).trim().toLowerCase();
    for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 70%, 80%)`;
}

function formatDate(d) {
    return d.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
}

// Read "Subject - YYYY-MM-DD" lines into [{label, date}]
function parseExamDates(text) {
    return text.split('\n')
        .map(line => {
            const m = line.match(/(\d{4}-\d{2}-\d{2})/);
            if(!m) return null;
            const date = new Date(m[1] + 'T00:00:00');
            if(isNaN(date)) return null;
            const label = line.replace(m[1], '').replace(/[-:–,]+\s*$/, '').replace(/^\s*[-:–,]+/, '').trim();
            return { label: label || 'Exam', date };
        })
        .filter(Boolean);
}

function startTimeValue(time) {
    const m = String(time).match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if(!m) return Infinity;
    let h = +m[1];
    const ap = (m[3] || '').toLowerCase();
    if(ap === 'pm' && h < 12) h += 12;
    if(ap === 'am' && h === 12) h = 0;
    return h * 60 + (+m[2] || 0);
}

function renderPlanGrid(entries) {
    const days = [...new Set(entries.map(e => String(e.day)))];
    const times = [...new Set(entries.map(e => String(e.time)))]
        .sort((a, b) => startTimeValue(a) - startTimeValue(b));
    const cells = {};
    entries.forEach(e => {
        const key = `${e.day}|${e.time}`;
        (cells[key] = cells[key] || []).push(e.subject);
    });

    let html = `<table><thead><tr><th>Time</th>${days.map(d => `<th>${escapeHTML(d)}</th>`).join('')}</tr></thead><tbody>`;
    times.forEach(t => {
        html += `<tr><td><strong>${escapeHTML(t)}</strong></td>`;
        days.forEach(d => {
            const subs = cells[`${d}|${t}`] || [];
            html += `<td>${subs.map(s => `<span class="subject-pill" style="background:${getSubjectColor(s)}">${escapeHTML(s)}</span>`).join('<br>')}</td>`;
        });
        html += `</tr>`;
    });
    html += `</tbody></table>`;

    const out = document.getElementById('planner-output');
    out.classList.remove('placeholder');
    out.innerHTML = html;

    const subjects = [...new Set(entries.map(e => String(e.subject)))];
    document.getElementById('planner-legend').innerHTML = subjects
        .map(s => `<span class="subject-pill" style="background:${getSubjectColor(s)}; color:#202124;">${escapeHTML(s)}</span>`)
        .join('');
}

async function generatePlan(btn, regenerate) {
    const sub = document.getElementById('plan-subjects').value.trim();
    const hours = document.getElementById('plan-hours').value.trim();
    const examText = document.getElementById('plan-exams').value.trim();
    const errCont = document.getElementById('planner-error');
    errCont.textContent = '';

    if(!sub || !hours || !examText) return errCont.textContent = "Fill out all fields";

    const exams = parseExamDates(examText);
    if(!exams.length) return errCont.textContent = "Add at least one date in YYYY-MM-DD format (e.g. Math - 2026-10-15).";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastExam = new Date(Math.max(...exams.map(e => e.date)));
    const daysLeft = Math.round((lastExam - today) / 86400000);
    if(daysLeft < 1) return errCont.textContent = "Exam dates must be in the future.";
    const planDays = Math.min(daysLeft, MAX_PLAN_DAYS);

    const examList = exams.map(e => `${e.label}: ${formatDate(e.date)}`).join('; ');
    let prompt = `Create a balanced day-wise study timetable starting today (${formatDate(today)}) for the next ${planDays} days.
Subjects: ${sub}
Study hours available per day: ${hours}
Exam / target dates: ${examList}
Give more time to subjects whose exam is sooner, stop scheduling a subject after its exam date, and include short revision slots before each exam.
Use day labels like "Mon 29 Sep" and time slots like "09:00-10:30". Return ONLY a strict flat JSON array. Schema: [{"day":"String","time":"String","subject":"String"}]`;
    if(regenerate && lastPlan) {
        prompt += `\n\nThe student wants a DIFFERENT balance from this previous plan, so rearrange the subject order, slot times and time split noticeably:\n${JSON.stringify(lastPlan)}`;
    }

    setBusy(btn, true, regenerate ? 'Regenerating...' : 'Generating...');
    const result = await callGemini(prompt, 'planner-error', { json: true });
    if(result) {
        const data = parseStrictJSON(result, 'planner-error');
        const valid = (Array.isArray(data) ? data : []).filter(e => e && e.day && e.time && e.subject);
        if(valid.length) {
            lastPlan = valid;
            renderPlanGrid(valid);
            document.getElementById('btn-planner-regen').classList.remove('hidden');
            if(daysLeft > MAX_PLAN_DAYS) errCont.textContent = `Showing the first ${MAX_PLAN_DAYS} days of your plan.`;
        } else if(data) {
            errCont.textContent = "AI returned the plan in an unexpected shape. Please try again.";
        }
    }
    setBusy(btn, false);
}

document.getElementById('btn-planner').addEventListener('click', (e) => generatePlan(e.currentTarget, false));
document.getElementById('btn-planner-regen').addEventListener('click', (e) => generatePlan(e.currentTarget, true));


// --- 10. OCR Summarizer ---
let ocrPreviewURL = null;

document.getElementById('ocr-image').addEventListener('change', (e) => {
    const preview = document.getElementById('ocr-preview');
    if(ocrPreviewURL) URL.revokeObjectURL(ocrPreviewURL);
    const file = e.target.files[0];
    if(!file) {
        ocrPreviewURL = null;
        return preview.classList.add('hidden');
    }
    ocrPreviewURL = URL.createObjectURL(file);
    preview.src = ocrPreviewURL;
    preview.classList.remove('hidden');
});

// Step 1: extract only, so the student can verify/correct the text before summarizing
document.getElementById('btn-ocr').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const fileInput = document.getElementById('ocr-image');
    const errCont = document.getElementById('ocr-error');
    errCont.textContent = '';

    if(!fileInput.files.length) return errCont.textContent = "Please upload an image first.";
    if(typeof Tesseract === 'undefined') return errCont.textContent = "OCR library is still loading. Try again in a moment.";

    setBusy(btn, true, 'Extracting...');

    let worker;
    try {
        worker = await Tesseract.createWorker('eng', 1, {
            logger: m => {
                if(m.status === 'recognizing text') {
                    btn.innerHTML = `Extracting ${Math.round(m.progress * 100)}% <i class="fas fa-spinner fa-spin"></i>`;
                }
            }
        });
        const ret = await worker.recognize(fileInput.files[0]);
        const extractedText = ret.data.text;

        document.getElementById('ocr-raw').value = extractedText;
        document.getElementById('btn-ocr-summarize').disabled = !extractedText.trim();
        if(!extractedText.trim()) errCont.textContent = "No text found in image.";
    } catch(err) {
        console.error(err);
        errCont.textContent = "OCR Failed: " + err.message;
    } finally {
        if(worker) await worker.terminate();
    }
    setBusy(btn, false);
});

document.getElementById('ocr-raw').addEventListener('input', (e) => {
    document.getElementById('btn-ocr-summarize').disabled = !e.target.value.trim();
});

// Step 2: summarize the (possibly corrected) text
document.getElementById('btn-ocr-summarize').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const text = document.getElementById('ocr-raw').value.trim();
    if(!text) return;

    setBusy(btn, true, 'Summarizing...');
    const prompt = `The following text was extracted from a photo of student notes using OCR and may contain small recognition errors. Summarize it into 4-6 key bullet points in Markdown. Do not include extra conversational text:\n\n${text}`;
    const result = await callGemini(prompt, 'ocr-error');
    if(result) {
        const sumDiv = document.getElementById('ocr-summary');
        sumDiv.classList.remove('placeholder');
        sumDiv.classList.add('markdown-body');
        sumDiv.innerHTML = sanitizeHTML(marked.parse(result));
    }
    setBusy(btn, false);
});
