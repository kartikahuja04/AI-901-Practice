// ─── Personal Device Session Tracker (Option A) ─────────────────────────────
function getMySessionIds() {
    try {
        const raw = localStorage.getItem("ai901_my_sessions");
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function recordMySessionId(sessionId) {
    if (!sessionId) return;
    try {
        const sessions = getMySessionIds();
        if (!sessions.includes(sessionId)) {
            sessions.push(sessionId);
            localStorage.setItem("ai901_my_sessions", JSON.stringify(sessions));
        }
    } catch (e) {
        console.error("Failed to record session in localStorage", e);
    }
}

function clearMyExamHistory() {
    if (confirm("Are you sure you want to clear your personal exam history from this device?")) {
        localStorage.removeItem("ai901_my_sessions");
        loadExamHistory();
    }
}

// REST Client: Load Past Exam Attempts (Filtered to Current Device)
async function loadExamHistory() {
    try {
        const response = await fetch("/api/history");
        const data = await response.json();

        // Filter: only show attempts belonging to this browser/device
        const mySessions = new Set(getMySessionIds());
        const personalHistory = (data.history || []).filter(item => mySessions.has(item.session_id));

        if (personalHistory && personalHistory.length > 0) {
            elements.historyTbody.innerHTML = "";
            personalHistory.forEach(item => {
                const date = new Date(item.timestamp).toLocaleString();
                const score = item.score;
                const statusClass = item.status === "PASS" ? "status-pass" : "status-fail";
                const total = item.correct_count + item.incorrect_count;

                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${date}</td>
                    <td class="cmd-code">${score}</td>
                    <td><span class="badge-status ${statusClass}">${item.status}</span></td>
                    <td>${item.correct_count} / ${total}</td>
                    <td><button class="action-btn secondary-btn medium-btn view-report-btn" data-session="${item.session_id}">View Analytics</button></td>
                `;
                elements.historyTbody.appendChild(row);
            });

            // Bind click handlers to static view buttons
            document.querySelectorAll(".view-report-btn").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    const sessId = e.target.getAttribute("data-session");
                    viewPastReport(sessId);
                });
            });
        } else {
            elements.historyTbody.innerHTML = `
                <tr>
                    <td colspan="5" class="no-history">No personal exam attempts found on this device. Start a practice exam to track your scores!</td>
                </tr>
            `;
        }
    } catch (e) {
        console.error("Error loading exam history:", e);
    }
}

// REST Client: Initiate new mock session
async function startNewExam() {
    // Show loading state
    const btn = elements.startExamBtn;
    const originalText = btn.textContent;
    btn.textContent = "⏳ Loading exam...";
    btn.disabled = true;
    btn.style.opacity = "0.7";

    try {
        logStatus("Initiating new mock session...");
        const response = await fetch("/api/exam/start", { method: "POST", body: JSON.stringify({}) });
        const data = await response.json();

        if (data.session_id) {
            // Track this session on this device
            recordMySessionId(data.session_id);

            // Setup session state
            state = {
                session_id: data.session_id,
                questions: data.questions,
                currentIdx: 0,
                answers: {},
                timeSpent: {},
                marked: new Set(),
                seen: new Set(),
                duration: 0,
                timerId: null,
                lastActiveTime: Date.now()
            };

            // Mark first question as seen
            state.seen.add(state.questions[0].id);

            saveSessionToLocalStorage();
            buildSidebarGrid();
            switchView("exam");
            loadQuestion(0);
            startTimer();
            logStatus("New exam session successfully started.");
        }
    } catch (e) {
        logStatus("Error starting exam: Server communication failure.");
        console.error(e);
    } finally {
        // Restore button regardless of outcome
        btn.textContent = originalText;
        btn.disabled = false;
        btn.style.opacity = "";
    }
}