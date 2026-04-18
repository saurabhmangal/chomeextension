document.addEventListener('DOMContentLoaded', async () => {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const summaryText = document.getElementById('summary-text');
    const pageTitle = document.getElementById('page-title');
    const imageCount = document.getElementById('image-count');
    const highResCount = document.getElementById('high-res-count');
    const gallery = document.getElementById('wallpaper-gallery');
    const refreshBtn = document.getElementById('refresh-summary');
    const statusLog = document.getElementById('status-log');

    function log(message, type = 'working') {
        const iconClass = type === 'done' ? 'done' : (type === 'fail' ? 'fail' : 'working');
        const li = document.createElement('li');
        li.innerHTML = `<span class="status-icon ${iconClass}"></span>${message}`;
        statusLog.appendChild(li);
        // Keep only last 5 logs
        while (statusLog.children.length > 5) {
            statusLog.removeChild(statusLog.firstChild);
        }
    }

    // Tab Switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });

    // Analyze Page
    async function analyze() {
        statusLog.innerHTML = '';
        log("Connecting to page scout...");
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab || !tab.id) {
            log("No active tab found", "fail");
            return;
        }

        try {
            log("Scanning page content & images...");
            const response = await chrome.tabs.sendMessage(tab.id, { action: "analyzePage" });
            if (response) {
                log(`Scanned: ${response.images.length} images found`, "done");
                renderSummary(response.content, response.images.length);
                renderGallery(response.images);
            }
        } catch (err) {
            log("Connection failed: Page needs refresh", "fail");
            summaryText.innerHTML = "Unable to analyze this page. Please refresh the page and try again.";
            console.error(err);
        }
    }

    function renderSummary(content, totalImages) {
        pageTitle.innerText = content.title;
        imageCount.innerText = `${totalImages} Images Found`;
        
        summaryText.innerHTML = '<div class="loading-pulse">Gemini is analyzing...</div>';
        log("Sending data to Gemini AI...");

        const combinedText = `Title: ${content.title}\n\n` + 
                           `Headings: ${content.headings.join(', ')}\n\n` + 
                           `Content: ${content.paragraphs.join('\n')}`;

        chrome.runtime.sendMessage({ 
            action: "summarizeWithGemini", 
            text: combinedText 
        }, response => {
            if (response && response.summary) {
                log("Gemini analysis complete", "done");
                summaryText.innerHTML = `<div class="summary-text">${formatSummary(response.summary)}</div>`;
            } else {
                const errorMsg = response && response.error ? response.error : "Unknown error";
                log(`Gemini failed: ${errorMsg}`, "fail");
                summaryText.innerHTML = `<div class="summary-text error">AI analysis failed: ${errorMsg}</div>` + 
                                       `<div class="summary-text" style="opacity: 0.6;"><strong>Basic Extract:</strong><br>${content.paragraphs[0] || 'No content found.'}</div>`;
            }
        });
    }

    function formatSummary(text) {
        // Basic markdown-like formatting for bullets
        return text.replace(/\*/g, '•').replace(/\n/g, '<br>');
    }

    function renderGallery(images) {
        const highRes = images.filter(img => img.isEligible);
        highResCount.innerText = highRes.length;
        
        if (highRes.length === 0) {
            gallery.innerHTML = '<div class="empty-state" style="text-align:center; padding: 2rem; color: var(--text-dim);">No HD wallpapers detected on this page.</div>';
            return;
        }

        gallery.innerHTML = '';
        highRes.forEach(img => {
            const card = document.createElement('div');
            card.className = 'wallpaper-card';
            card.innerHTML = `
                <img src="${img.src}" alt="Wallpaper">
                <div class="wallpaper-overlay">
                    <span class="res-tag">${img.width} × ${img.height}</span>
                    <button class="btn-download" data-url="${img.src}">Set as Background</button>
                    <p style="font-size: 9px; color: var(--text-dim); margin-top: 5px; text-align: center;">Downloads image. Right-click to set as desktop.</p>
                </div>
            `;
            
            card.querySelector('.btn-download').addEventListener('click', (e) => {
                e.stopPropagation();
                log("Downloading wallpaper...", "working");
                chrome.downloads.download({
                    url: img.src,
                    filename: `NexusWallpaper-${Date.now()}.jpg`,
                    saveAs: false // Download directly to keep it smooth
                }, (downloadId) => {
                    if (downloadId) {
                        log("Wallpaper ready! Set it via your downloads.", "done");
                    }
                });
            });

            gallery.appendChild(card);
        });
    }

    refreshBtn.addEventListener('click', analyze);

    // Settings: load saved key
    const apiKeyInput = document.getElementById('api-key-input');
    const apiKeyStatus = document.getElementById('api-key-status');
    chrome.storage.local.get("GEMINI_API_KEY", ({ GEMINI_API_KEY }) => {
        if (GEMINI_API_KEY) {
            apiKeyInput.value = GEMINI_API_KEY;
            apiKeyStatus.textContent = "API key is set.";
        }
    });

    document.getElementById('save-api-key').addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (!key) {
            apiKeyStatus.textContent = "Please enter a valid API key.";
            return;
        }
        chrome.storage.local.set({ GEMINI_API_KEY: key }, () => {
            apiKeyStatus.textContent = "API key saved successfully.";
        });
    });

    document.getElementById('clear-api-key').addEventListener('click', () => {
        chrome.storage.local.remove("GEMINI_API_KEY", () => {
            apiKeyInput.value = "";
            apiKeyStatus.textContent = "API key cleared.";
        });
    });

    // Initial analysis
    analyze();
});
