/**
 * Frauditor Popup Controller
 * Manages the extension popup interface and user interactions
 */

// DOM elements
const elements = {
    statusIcon: document.getElementById('statusIcon'),
    statusTitle: document.getElementById('statusTitle'),
    statusSubtitle: document.getElementById('statusSubtitle'),
    statusCard: document.getElementById('statusCard'),
    reviewInput: document.getElementById('reviewInput'),
    analyzeBtn: document.getElementById('analyzeBtn'),
    analysisResult: document.getElementById('analysisResult'),
    totalAnalyzed: document.getElementById('totalAnalyzed'),
    fakeDetected: document.getElementById('fakeDetected'),
    avgConfidence: document.getElementById('avgConfidence'),
    cacheHits: document.getElementById('cacheHits'),
    clearCacheBtn: document.getElementById('clearCacheBtn'),
    refreshStatsBtn: document.getElementById('refreshStatsBtn'),
    pieChart: document.getElementById('pieChart'),
    barChart: document.getElementById('barChart'),
    wordCloud: document.getElementById('wordCloud'),
    recentHistory: document.getElementById('recentHistory'),
    shareResultBtn: document.getElementById('shareResultBtn'),
    judgeModeBtn: document.getElementById('judgeModeBtn'),
    gifExportBtn: document.getElementById('gifExportBtn'),
    themeToggle: document.getElementById('themeToggle')
};

// State
let isAnalyzing = false;
let stats = {
    totalAnalyzed: 0,
    fakeDetected: 0,
    avgConfidence: 0,
    cacheHits: 0
};

// Add: Recent history, chart, dark mode, animated counters
let history = [];
let darkMode = false;
let cache = new Map();
let wordFreq = {};
let timeTrend = [];
let judgeMode = false;
let lastResult = null;

// Mock ML model for demo purposes
function mockAnalyzeReview(text) {
    // Simple heuristics for demo
    const keywords = ['free', 'amazing', 'best ever', 'perfect', 'worst', 'terrible', 'scam'];
    const hasKeyword = keywords.some(kw => text.toLowerCase().includes(kw));
    const isFake = hasKeyword || text.length < 20 || /[!?]{2,}/.test(text);
    
    const confidence = 0.5 + Math.random() * 0.4;
    const riskLevel = isFake ? (confidence > 0.8 ? 'High' : 'Medium') : 'Low';
    const quality = Math.round(isFake ? 30 + Math.random() * 30 : 60 + Math.random() * 40);
    
    return {
        prediction: isFake ? 'fake' : 'real',
        confidence: confidence,
        riskLevel: riskLevel,
        text: text,
        details: {
            quality: quality,
            malaysian: text.toLowerCase().includes('rm') || text.toLowerCase().includes('ringgit')
        }
    };
}

// Initialize popup
async function initializePopup() {
    console.log('Initializing Frauditor popup');
    
    // Load saved data
    await loadSavedData();
    
    // Check system status
    await checkSystemStatus();
    
    // Setup event listeners
    setupEventListeners();
    
    // Update UI
    updateAllVisuals();
    
    console.log('Popup initialized');
}

// Load saved data from storage
async function loadSavedData() {
    try {
        const data = await chrome.storage.local.get([
            'frauditorStats',
            'frauditorHistory',
            'frauditorDarkMode',
            'frauditorCache',
            'frauditorWordFreq',
            'frauditorTimeTrend',
            'frauditorJudgeMode'
        ]);
        
        if (data.frauditorStats) {
            stats = { ...stats, ...data.frauditorStats };
        }
        
        if (data.frauditorHistory) {
            history = data.frauditorHistory;
        }
        
        if (data.frauditorCache) {
            cache = new Map(Object.entries(data.frauditorCache));
        }
        
        if (data.frauditorWordFreq) {
            wordFreq = data.frauditorWordFreq;
        }
        
        if (data.frauditorTimeTrend) {
            timeTrend = data.frauditorTimeTrend;
        }
        
        judgeMode = !!data.frauditorJudgeMode;
        setDarkMode(!!data.frauditorDarkMode);
        
    } catch (error) {
        console.error('Failed to load saved data:', error);
    }
}

// Save all data to storage
async function saveAllData() {
    try {
        await chrome.storage.local.set({
            frauditorStats: stats,
            frauditorHistory: history,
            frauditorCache: Object.fromEntries(cache),
            frauditorWordFreq: wordFreq,
            frauditorTimeTrend: timeTrend,
            frauditorDarkMode: darkMode,
            frauditorJudgeMode: judgeMode
        });
    } catch (error) {
        console.error('Failed to save data:', error);
    }
}

// Check system status
async function checkSystemStatus() {
    try {
        elements.statusIcon.textContent = '⏳';
        elements.statusTitle.textContent = 'Checking Status...';
        elements.statusSubtitle.textContent = 'Initializing detection service';
        elements.statusCard.className = 'status-card';
        
        // Simulate API check
        await new Promise(resolve => setTimeout(resolve, 500));
        
        elements.statusIcon.textContent = '✅';
        elements.statusTitle.textContent = 'System Online';
        elements.statusSubtitle.textContent = 'Real-time detection active';
        elements.statusCard.className = 'status-card connected';
        
    } catch (error) {
        console.error('Status check failed:', error);
        elements.statusIcon.textContent = '❌';
        elements.statusTitle.textContent = 'System Error';
        elements.statusSubtitle.textContent = 'Detection service unavailable';
        elements.statusCard.className = 'status-card error';
    }
}

// Handle analyze button click
async function handleAnalyze() {
    if (isAnalyzing) return;
    
    const text = elements.reviewInput.value.trim();
    if (!text) {
        showError('Please enter a review to analyze');
        return;
    }
    
    if (text.length < 3) {
        showError('Review too short (minimum 3 characters)');
        return;
    }
    
    try {
        isAnalyzing = true;
        updateAnalyzeButton(true);
        hideResult();
        
        // Check cache first
        let result;
        if (cache.has(text)) {
            result = cache.get(text);
            result.cached = true;
            stats.cacheHits++;
        } else {
            // Use mock analysis for demo
            result = mockAnalyzeReview(text);
            cache.set(text, result);
        }
        
        showResult(result);
        updateStats(result);
        saveAllData();
        
        if (judgeMode && result.prediction === 'fake') {
            launchConfetti();
        }
        
    } catch (error) {
        showError('Analysis failed: ' + error.message);
    } finally {
        isAnalyzing = false;
        updateAnalyzeButton(false);
    }
}

// Show analysis result
function showResult(result) {
    let className = 'analysis-result ';
    let content = '';
    
    if (result.prediction === 'fake') {
        className += 'fake';
        content = `
            <div style="font-weight: 600; margin-bottom: 4px;">
                Potentially Fake Review
            </div>
            <div>
                Confidence: ${Math.round((result.confidence || 0) * 100)}% • 
                Risk: ${result.riskLevel || 'Unknown'}
            </div>
            ${result.details?.malaysian ? '<div style="margin-top: 4px;">🇲🇾 Malaysian context detected</div>' : ''}
        `;
    } else {
        className += 'genuine';
        content = `
            <div style="font-weight: 600; margin-bottom: 4px;">
                Likely Genuine Review
            </div>
            <div>
                Confidence: ${Math.round((result.confidence || 0) * 100)}% • 
                Quality: ${result.details?.quality || 'N/A'}/100
            </div>
            ${result.details?.malaysian ? '<div style="margin-top: 4px;">🇲🇾 Malaysian context detected</div>' : ''}
        `;
    }
    
    elements.analysisResult.className = className;
    elements.analysisResult.innerHTML = content;
    elements.analysisResult.style.display = 'block';
    
    // Save as last result for sharing
    lastResult = result;
}

// Show error message
function showError(message) {
    elements.analysisResult.className = 'analysis-result error';
    elements.analysisResult.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 4px;">
            Error
        </div>
        <div>${message}</div>
    `;
    elements.analysisResult.style.display = 'block';
}

// Hide result
function hideResult() {
    elements.analysisResult.style.display = 'none';
}

// Update analyze button state
function updateAnalyzeButton(analyzing) {
    const btnText = elements.analyzeBtn.querySelector('.btn-text');
    const btnLoader = elements.analyzeBtn.querySelector('.btn-loader');
    
    elements.analyzeBtn.disabled = analyzing;
    
    if (analyzing) {
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline';
    } else {
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
    }
}

// Update statistics
function updateStats(result) {
    stats.totalAnalyzed++;
    
    if (result.prediction === 'fake') {
        stats.fakeDetected++;
    }
    
    if (result.confidence) {
        const totalConfidence = stats.avgConfidence * (stats.totalAnalyzed - 1) + result.confidence;
        stats.avgConfidence = totalConfidence / stats.totalAnalyzed;
    }
    
    // Add to history
    history.push({
        text: result.text || '',
        prediction: result.prediction,
        confidence: result.confidence,
        timestamp: new Date().toISOString()
    });
    
    if (history.length > 50) {
        history = history.slice(-50);
    }
    
    // Update word frequency
    if (result.prediction === 'fake' && result.text) {
        result.text.toLowerCase().split(/\W+/).forEach(word => {
            if (word.length > 3) {
                wordFreq[word] = (wordFreq[word] || 0) + 1;
            }
        });
    }
    
    // Update time trend
    const now = new Date();
    const hour = now.getHours();
    const found = timeTrend.find(t => t.hour === hour);
    
    if (found) {
        found.total++;
        if (result.prediction === 'fake') found.fake++;
        else found.real++;
    } else {
        timeTrend.push({
            hour,
            total: 1,
            fake: result.prediction === 'fake' ? 1 : 0,
            real: result.prediction === 'fake' ? 0 : 1
        });
    }
    
    // Keep only last 24 hours
    timeTrend = timeTrend.slice(-24);
    
    updateAllVisuals();
}

// Update all visualizations
function updateAllVisuals() {
    updateStatsDisplay();
    updateHistoryDisplay();
    updatePieChart();
    updateBarChart();
    updateWordCloud();
}

// Update stats display
function updateStatsDisplay() {
    elements.totalAnalyzed.textContent = stats.totalAnalyzed.toString();
    elements.fakeDetected.textContent = stats.fakeDetected.toString();
    elements.avgConfidence.textContent = Math.round(stats.avgConfidence * 100) + '%';
    elements.cacheHits.textContent = stats.cacheHits.toString();
}

// Update history display
function updateHistoryDisplay() {
    if (!elements.recentHistory) return;
    elements.recentHistory.innerHTML = '';
    
    history.slice(-7).reverse().forEach(item => {
        const li = document.createElement('li');
        li.className = item.prediction === 'fake' ? 'fake' : 'genuine';
        li.innerHTML = `
            <span>${item.text.length > 30 ? item.text.slice(0, 30) + '…' : item.text}</span>
            <span class="confidence">${Math.round((item.confidence || 0) * 100)}%</span>
        `;
        elements.recentHistory.appendChild(li);
    });
}

// Update pie chart
function updatePieChart() {
    if (!elements.pieChart) return;
    const ctx = elements.pieChart.getContext('2d');
    ctx.clearRect(0, 0, elements.pieChart.width, elements.pieChart.height);
    
    const total = stats.totalAnalyzed || 1;
    const fake = stats.fakeDetected || 0;
    const fakeAngle = (fake / total) * 2 * Math.PI;
    
    // Fake (red)
    ctx.beginPath();
    ctx.moveTo(60, 60);
    ctx.arc(60, 60, 55, 0, fakeAngle, false);
    ctx.closePath();
    ctx.fillStyle = '#ff416c';
    ctx.fill();
    
    // Real (green)
    ctx.beginPath();
    ctx.moveTo(60, 60);
    ctx.arc(60, 60, 55, fakeAngle, 2 * Math.PI, false);
    ctx.closePath();
    ctx.fillStyle = '#38ef7d';
    ctx.fill();
    
    // Center text
    ctx.font = 'bold 18px Segoe UI, Arial';
    ctx.fillStyle = darkMode ? '#fff' : '#333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round((fake/total)*100)}% Fake`, 60, 60);
}

// Update bar chart
function updateBarChart() {
    if (!elements.barChart) return;
    const ctx = elements.barChart.getContext('2d');
    const w = elements.barChart.width;
    const h = elements.barChart.height;
    
    ctx.clearRect(0, 0, w, h);
    
    const max = Math.max(1, ...timeTrend.map(x => x.total));
    const barW = 18;
    const gap = 8;
    
    timeTrend.slice(-10).forEach((item, i) => {
        const x = 10 + i * (barW + gap);
        const realH = (item.real / max) * (h - 30);
        const fakeH = (item.fake / max) * (h - 30);
        
        // Real (green)
        ctx.fillStyle = '#38ef7d';
        ctx.fillRect(x, h - realH - 8, barW, realH);
        
        // Fake (red)
        ctx.fillStyle = '#ff416c';
        ctx.fillRect(x, h - realH - fakeH - 8, barW, fakeH);
        
        // Label
        ctx.font = '10px Segoe UI, Arial';
        ctx.fillStyle = darkMode ? '#fff' : '#333';
        ctx.textAlign = 'center';
        ctx.fillText(`${item.hour}:00`, x + barW / 2, h - 2);
    });
}

// Update word cloud
function updateWordCloud() {
    if (!elements.wordCloud) return;
    elements.wordCloud.innerHTML = '';
    
    const words = Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12);
    
    words.forEach(([word, freq]) => {
        const span = document.createElement('span');
        span.textContent = word;
        span.style.fontSize = 13 + Math.min(17, freq * 2) + 'px';
        span.title = `Appeared in ${freq} fake review${freq > 1 ? 's' : ''}`;
        elements.wordCloud.appendChild(span);
    });
}

// Clear cache
async function handleClearCache() {
    try {
        // Clear local cache
        cache.clear();
        stats.cacheHits = 0;
        
        // Reset word frequency and time trend
        wordFreq = {};
        timeTrend = [];
        
        // Visual feedback animation
        elements.clearCacheBtn.classList.add('active');
        elements.cacheHits.classList.add('animated');
        
        // Update UI
        updateAllVisuals();
        await saveAllData();
        
        // Show success message
        elements.clearCacheBtn.textContent = '✅ Cache Cleared!';
        setTimeout(() => {
            elements.clearCacheBtn.textContent = '🗑️ Clear Cache';
            elements.clearCacheBtn.classList.remove('active');
        }, 2000);
        
    } catch (error) {
        console.error('Failed to clear cache:', error);
        elements.clearCacheBtn.textContent = '❌ Failed';
        setTimeout(() => {
            elements.clearCacheBtn.textContent = '🗑️ Clear Cache';
        }, 2000);
    }
}

// Refresh stats
async function handleRefreshStats() {
    try {
        // Visual feedback
        elements.refreshStatsBtn.classList.add('active');
        elements.refreshStatsBtn.textContent = '⏳ Refreshing...';
        
        // Reload all data
        await loadSavedData();
        
        // Animate stats update
        ['totalAnalyzed', 'fakeDetected', 'avgConfidence', 'cacheHits'].forEach(id => {
            elements[id].classList.add('animated');
            setTimeout(() => elements[id].classList.remove('animated'), 1000);
        });
        
        // Update all visualizations
        updateAllVisuals();
        
        // Show success message
        elements.refreshStatsBtn.textContent = '✅ Stats Updated!';
        setTimeout(() => {
            elements.refreshStatsBtn.textContent = '🔄 Refresh Stats';
            elements.refreshStatsBtn.classList.remove('active');
        }, 2000);
        
    } catch (error) {
        console.error('Failed to refresh stats:', error);
        elements.refreshStatsBtn.textContent = '❌ Failed';
        setTimeout(() => {
            elements.refreshStatsBtn.textContent = '🔄 Refresh Stats';
        }, 2000);
    }
}

// Share result
async function handleShareResult() {
    if (!lastResult) {
        elements.shareResultBtn.textContent = '❌ No Result';
        setTimeout(() => {
            elements.shareResultBtn.textContent = '📤 Share Result';
        }, 2000);
        return;
    }
    
    try {
        const summary = `🔍 Frauditor Review Analysis

📝 Review Text:
"${lastResult.text}"

🎯 Result: ${lastResult.prediction === 'fake' ? '⚠️ Potentially Fake' : '✅ Likely Genuine'}
📊 Confidence: ${Math.round((lastResult.confidence || 0) * 100)}%
⚖️ Risk Level: ${lastResult.riskLevel || 'N/A'}
${lastResult.details?.malaysian ? '🇲🇾 Malaysian context detected' : ''}

Generated by Frauditor - Real-time fake review detection`;
        
        await navigator.clipboard.writeText(summary);
        
        // Visual feedback
        elements.shareResultBtn.classList.add('active');
        elements.shareResultBtn.textContent = '✅ Copied!';
        
        // Create and show notification
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = 'Result copied to clipboard!';
        document.body.appendChild(notification);
        
        setTimeout(() => {
            elements.shareResultBtn.textContent = '📤 Share Result';
            elements.shareResultBtn.classList.remove('active');
            document.body.removeChild(notification);
        }, 2000);
        
    } catch (error) {
        console.error('Failed to share result:', error);
        elements.shareResultBtn.textContent = '❌ Failed';
        setTimeout(() => {
            elements.shareResultBtn.textContent = '📤 Share Result';
        }, 2000);
    }
}

// Toggle judge mode
function toggleJudgeMode() {
    judgeMode = !judgeMode;
    elements.judgeModeBtn.classList.toggle('active', judgeMode);
    elements.judgeModeBtn.textContent = judgeMode ? '🎉 Judge Mode ON' : '👨‍⚖️ Judge Mode';
    saveAllData();
}

// Toggle dark mode
function setDarkMode(enabled) {
    darkMode = enabled;
    document.body.classList.toggle('dark', enabled);
    elements.themeToggle.textContent = enabled ? '☀️' : '🌙';
    updatePieChart();
    updateBarChart();
}

// Launch confetti
function launchConfetti() {
    const container = document.getElementById('confettiContainer');
    if (!container) return;
    
    const audio = document.getElementById('confettiSound');
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {}); // Ignore autoplay restrictions
    }
    
    for (let i = 0; i < 40; i++) {
        const conf = document.createElement('div');
        conf.className = 'confetti-piece';
        conf.style.left = Math.random() * 100 + 'vw';
        conf.style.background = `hsl(${Math.random()*360},80%,60%)`;
        conf.style.top = '-20px';
        conf.style.transform = `rotate(${Math.random()*360}deg)`;
        container.appendChild(conf);
        
        setTimeout(() => {
            conf.style.transition = 'top 1.2s cubic-bezier(.4,2,.6,1), left 1.2s linear';
            conf.style.top = 80 + Math.random()*20 + 'vh';
            conf.style.left = (parseFloat(conf.style.left) + (Math.random()-0.5)*40) + 'vw';
        }, 10);
        
        setTimeout(() => container.removeChild(conf), 1400);
    }
}

// Export as GIF
async function handleGifExport() {
    if (gifExporting) return;
    
    try {
        gifExporting = true;
        elements.gifExportBtn.classList.add('active');
        elements.gifExportBtn.textContent = '⏳ Preparing...';
        
        // Load required libraries
        await Promise.all([
            loadScript('https://html2canvas.hertzen.com/dist/html2canvas.min.js'),
            loadScript('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js')
        ]);
        
        elements.gifExportBtn.textContent = '📸 Recording...';
        
        const container = document.querySelector('.popup-container');
        if (!container) throw new Error('Container not found');
        
        // Create GIF
        const gif = new GIF({
            workers: 2,
            quality: 10,
            width: container.offsetWidth,
            height: container.offsetHeight,
            workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js'
        });
        
        // Add loading indicator
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = '<div class="loading-spinner"></div><div>Recording...</div>';
        document.body.appendChild(loadingOverlay);
        
        // Record frames
        const frames = 15;
        for (let i = 0; i < frames; i++) {
            elements.gifExportBtn.textContent = `📸 Recording ${Math.round((i/frames)*100)}%`;
            const canvas = await html2canvas(container, {
                scale: 1,
                useCORS: true,
                allowTaint: true,
                backgroundColor: null
            });
            gif.addFrame(canvas, { delay: 100 });
            await new Promise(res => setTimeout(res, 100));
        }
        
        elements.gifExportBtn.textContent = '⚡ Processing...';
        
        // Render and download
        gif.on('progress', percent => {
            elements.gifExportBtn.textContent = `⚡ Processing ${Math.round(percent*100)}%`;
        });
        
        gif.on('finished', function(blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `frauditor-dashboard-${new Date().toISOString().slice(0,10)}.gif`;
            a.click();
            URL.revokeObjectURL(url);
            
            // Cleanup
            document.body.removeChild(loadingOverlay);
            elements.gifExportBtn.textContent = '✅ GIF Saved!';
            setTimeout(() => {
                elements.gifExportBtn.textContent = '🎬 Export GIF';
                elements.gifExportBtn.classList.remove('active');
            }, 2000);
            gifExporting = false;
        });
        
        gif.render();
        
    } catch (error) {
        console.error('GIF export failed:', error);
        elements.gifExportBtn.textContent = '❌ Failed';
        const loadingOverlay = document.querySelector('.loading-overlay');
        if (loadingOverlay) document.body.removeChild(loadingOverlay);
        setTimeout(() => {
            elements.gifExportBtn.textContent = '🎬 Export GIF';
            elements.gifExportBtn.classList.remove('active');
        }, 2000);
        gifExporting = false;
    }
}

// Helper function to load external scripts
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
    });
}

// Setup event listeners
function setupEventListeners() {
    // Analyze button
    elements.analyzeBtn.addEventListener('click', handleAnalyze);
    
    // Enter key in textarea
    elements.reviewInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            handleAnalyze();
        }
    });
    
    // Clear cache button
    elements.clearCacheBtn.addEventListener('click', handleClearCache);
    
    // Refresh stats button
    elements.refreshStatsBtn.addEventListener('click', handleRefreshStats);
    
    // Share result button
    elements.shareResultBtn.addEventListener('click', async () => {
        try {
            await handleShareResult();
        } catch (error) {
            console.error('Share failed:', error);
            elements.shareResultBtn.textContent = '❌ Failed';
            setTimeout(() => {
                elements.shareResultBtn.textContent = '📤 Share Result';
            }, 2000);
        }
    });
    
    // Judge mode button
    elements.judgeModeBtn.addEventListener('click', toggleJudgeMode);
    
    // Theme toggle
    elements.themeToggle.addEventListener('click', () => {
        setDarkMode(!darkMode);
        saveAllData();
    });
    
    // GIF export button
    elements.gifExportBtn.addEventListener('click', async () => {
        try {
            await handleGifExport();
        } catch (error) {
            console.error('GIF export failed:', error);
            elements.gifExportBtn.textContent = '❌ Failed';
            setTimeout(() => {
                elements.gifExportBtn.textContent = '🎬 Export GIF';
            }, 2000);
        }
    });
    
    // Help and feedback links
    document.getElementById('helpLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'https://github.com/Ywintersss/Frauditor' });
    });
    
    document.getElementById('feedbackLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'mailto:frauditor@example.com' });
    });
}

// Add CSS styles for new features
const style = document.createElement('style');
style.textContent = `
    .notification {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #4CAF50;
        color: white;
        padding: 10px 20px;
        border-radius: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        animation: slideUp 0.3s ease;
        z-index: 1000;
    }
    
    .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        z-index: 1000;
    }
    
    .loading-spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 10px;
    }
    
    .active {
        transform: scale(0.95);
        opacity: 0.8;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translate(-50%, 20px);
        }
        to {
            opacity: 1;
            transform: translate(-50%, 0);
        }
    }
`;
document.head.appendChild(style);

// Initialize on load
document.addEventListener('DOMContentLoaded', initializePopup);

console.log('Frauditor popup script loaded');