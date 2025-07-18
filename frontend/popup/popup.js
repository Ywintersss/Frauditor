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
    refreshStatsBtn: document.getElementById('refreshStatsBtn')
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

function updatePieChart() {
    const canvas = document.getElementById('pieChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const total = stats.totalAnalyzed || 1;
    const fake = stats.fakeDetected || 0;
    const real = total - fake;
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
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round((fake/total)*100)}% Fake`, 60, 60);
}

function updateHistoryDisplay() {
    const list = document.getElementById('recentHistory');
    list.innerHTML = '';
    history.slice(-7).reverse().forEach(item => {
        const li = document.createElement('li');
        li.className = item.prediction === 'fake' ? 'fake' : 'genuine';
        li.innerHTML = `<span>${item.text.length > 30 ? item.text.slice(0, 30) + '…' : item.text}</span>
            <span class="confidence">${Math.round((item.confidence || 0) * 100)}%</span>`;
        list.appendChild(li);
    });
}

function animateStat(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('animated');
    setTimeout(() => el.classList.remove('animated'), 600);
    el.textContent = value;
}

function setDarkMode(enabled) {
    darkMode = enabled;
    document.body.classList.toggle('dark', enabled);
    document.getElementById('themeToggle').textContent = enabled ? '☀️' : '🌙';
}

document.getElementById('themeToggle').addEventListener('click', () => {
    setDarkMode(!darkMode);
    chrome.storage.local.set({ frauditorDarkMode: darkMode });
});

// Load dark mode preference
chrome.storage.local.get(['frauditorDarkMode', 'frauditorHistory'], (data) => {
    setDarkMode(!!data.frauditorDarkMode);
    history = data.frauditorHistory || [];
    updateHistoryDisplay();
});

// Save history after each analysis
function saveHistory() {
    chrome.storage.local.set({ frauditorHistory: history });
}

/**
 * Initialize popup
 */
async function initializePopup() {
    console.log('Initializing Frauditor popup');
    
    // Check system status
    await checkSystemStatus();
    
    // Load stats
    await loadStats();
    
    // Setup event listeners
    setupEventListeners();
    
    // Update UI
    updateStatsDisplay();
    
    console.log('Popup initialized');
}

/**
 * Check system status
 */
async function checkSystemStatus() {
    try {
        elements.statusIcon.textContent = '⏳';
        elements.statusTitle.textContent = 'Checking Status...';
        elements.statusSubtitle.textContent = 'Connecting to detection service';
        elements.statusCard.className = 'status-card';
        
        // Test connection with background script
        const response = await chrome.runtime.sendMessage({
            action: 'getStats'
        });
        
        if (response) {
            elements.statusIcon.textContent = '✅';
            elements.statusTitle.textContent = 'System Online';
            elements.statusSubtitle.textContent = 'Real-time detection active';
            elements.statusCard.className = 'status-card connected';
        } else {
            throw new Error('No response from background script');
        }
        
    } catch (error) {
        console.error('Status check failed:', error);
        elements.statusIcon.textContent = '❌';
        elements.statusTitle.textContent = 'System Error';
        elements.statusSubtitle.textContent = 'Detection service unavailable';
        elements.statusCard.className = 'status-card error';
    }
}

/**
 * Load statistics
 */
async function loadStats() {
    try {
        // Load from storage
        const stored = await chrome.storage.local.get(['frauditorStats']);
        if (stored.frauditorStats) {
            stats = { ...stats, ...stored.frauditorStats };
        }
        
        // Get current session stats from background
        const backgroundStats = await chrome.runtime.sendMessage({
            action: 'getStats'
        });
        
        if (backgroundStats) {
            stats.cacheHits = backgroundStats.cacheSize || 0;
        }
        
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

/**
 * Save statistics
 */
async function saveStats() {
    try {
        await chrome.storage.local.set({ frauditorStats: stats });
    } catch (error) {
        console.error('Failed to save stats:', error);
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Analyze button
    elements.analyzeBtn.addEventListener('click', handleAnalyze);
    
    // Enter key in textarea
    elements.reviewInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            handleAnalyze();
        }
    });
    
    // Character count
    elements.reviewInput.addEventListener('input', updateCharacterCount);
    
    // Clear cache button
    elements.clearCacheBtn.addEventListener('click', handleClearCache);
    
    // Refresh stats button
    elements.refreshStatsBtn.addEventListener('click', handleRefreshStats);
    
    // Help and feedback links
    document.getElementById('helpLink').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'https://github.com/Ywintersss/Frauditor' });
    });
    
    document.getElementById('feedbackLink').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'mailto:frauditor@example.com' });
    });
}

/**
 * Handle review analysis
 */
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
        
        // Send analysis request
        const result = await chrome.runtime.sendMessage({
            action: 'analyzeReview',
            text: text,
            options: { source: 'popup' }
        });
        
        if (result && result.success !== false) {
            showResult(result);
            updateStats(result);
        } else {
            showError(result?.error || 'Analysis failed');
        }
        
    } catch (error) {
        console.error('❌ Analysis error:', error);
        showError('Analysis failed: ' + error.message);
    } finally {
        isAnalyzing = false;
        updateAnalyzeButton(false);
    }
}

/**
 * Update statistics
 */
function updateStats(result) {
    stats.totalAnalyzed++;
    
    if (result.prediction === 'fake') {
        stats.fakeDetected++;
    }
    
    if (result.confidence) {
        const totalConfidence = stats.avgConfidence * (stats.totalAnalyzed - 1) + result.confidence;
        stats.avgConfidence = totalConfidence / stats.totalAnalyzed;
    }
    
    if (result.cached) {
        stats.cacheHits++;
    }
    
    // Add to history
    history.push({
        text: result.text || '',
        prediction: result.prediction,
        confidence: result.confidence
    });
    if (history.length > 10) history = history.slice(-10);
    
    updateStatsDisplay();
    updateHistoryDisplay();
    updatePieChart();
    saveStats();
    saveHistory();
    animateStat('totalAnalyzed', stats.totalAnalyzed);
    animateStat('fakeDetected', stats.fakeDetected);
    animateStat('avgConfidence', Math.round(stats.avgConfidence * 100) + '%');
    animateStat('cacheHits', stats.cacheHits);
}

/**
 * Update stats display
 */
function updateStatsDisplay() {
    elements.totalAnalyzed.textContent = stats.totalAnalyzed.toString();
    elements.fakeDetected.textContent = stats.fakeDetected.toString();
    elements.avgConfidence.textContent = Math.round(stats.avgConfidence * 100) + '%';
    elements.cacheHits.textContent = stats.cacheHits.toString();
}

/**
 * Show analysis result
 */
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
    } else if (result.prediction === 'real') {
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
    } else {
        className += 'error';
        content = `
            <div style="font-weight: 600; margin-bottom: 4px;">
              Analysis Incomplete
            </div>
            <div>
                ${result.error || 'Unable to determine authenticity'}
            </div>
        `;
    }
    
    elements.analysisResult.className = className;
    elements.analysisResult.innerHTML = content;
    elements.analysisResult.style.display = 'block';
}

/**
 * Show error message
 */
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

/**
 * Hide result
 */
function hideResult() {
    elements.analysisResult.style.display = 'none';
}

/**
 * Update analyze button state
 */
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

/**
 * Update character count
 */
function updateCharacterCount() {
    const length = elements.reviewInput.value.length;
    const maxLength = elements.reviewInput.maxLength;
    
    if (length > maxLength * 0.9) {
        elements.reviewInput.style.borderColor = '#ff9800';
    } else {
        elements.reviewInput.style.borderColor = '#e9ecef';
    }
}

/**
 * Handle clear cache
 */
async function handleClearCache() {
    try {
        await chrome.runtime.sendMessage({ action: 'clearCache' });
        stats.cacheHits = 0;
        updateStatsDisplay();
        saveStats();
        
        // Show feedback
        elements.clearCacheBtn.textContent = 'Cleared';
        setTimeout(() => {
            elements.clearCacheBtn.textContent = 'Clear Cache';
        }, 2000);
        
        updatePieChart();
        updateHistoryDisplay();
        
    } catch (error) {
        console.error('Failed to clear cache:', error);
    }
}

/**
 * Handle refresh stats
 */
async function handleRefreshStats() {
    try {
        await loadStats();
        updateStatsDisplay();
        
        // Show feedback
        elements.refreshStatsBtn.textContent = 'Refreshed';
        setTimeout(() => {
            elements.refreshStatsBtn.textContent = 'Refresh Stats';
        }, 2000);
        
        updatePieChart();
        updateHistoryDisplay();
        
    } catch (error) {
        console.error('Failed to refresh stats:', error);
    }
}

// Bar chart for time trends
let timeTrend = [];
function updateBarChart() {
    const canvas = document.getElementById('barChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width, h = canvas.height;
    const max = Math.max(1, ...timeTrend.map(x => x.total));
    const barW = 18, gap = 8;
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
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.fillText(item.label, x + barW / 2, h - 2);
    });
}

// Word cloud for top suspicious words
let wordFreq = {};
function updateWordCloud() {
    const container = document.getElementById('wordCloud');
    if (!container) return;
    container.innerHTML = '';
    const words = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 12);
    words.forEach(([word, freq]) => {
        const span = document.createElement('span');
        span.textContent = word;
        span.style.fontSize = 13 + Math.min(17, freq * 2) + 'px';
        span.title = `Appeared in ${freq} fake review${freq > 1 ? 's' : ''}`;
        container.appendChild(span);
    });
}

// Share result button
let lastResult = null;
document.getElementById('shareResultBtn').addEventListener('click', () => {
    if (!lastResult) return;
    const summary = `Frauditor Review Analysis:\nText: ${lastResult.text}\nPrediction: ${lastResult.prediction}\nConfidence: ${Math.round((lastResult.confidence || 0) * 100)}%`;
    navigator.clipboard.writeText(summary);
    document.getElementById('shareResultBtn').textContent = '✅ Copied!';
    setTimeout(() => {
        document.getElementById('shareResultBtn').textContent = '📤 Share Result';
    }, 1800);
});

// Judge Mode
let judgeMode = false;
const judgeBtn = document.getElementById('judgeModeBtn');
judgeBtn.addEventListener('click', () => {
    judgeMode = !judgeMode;
    judgeBtn.classList.toggle('active', judgeMode);
    judgeBtn.textContent = judgeMode ? '🎉 Judge Mode ON' : '👨‍⚖️ Judge Mode';
});

// Confetti animation
function launchConfetti() {
    const container = document.getElementById('confettiContainer');
    if (!container) return;
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

// Update all visuals after each analysis
function updateAllVisuals() {
    updateStatsDisplay();
    updateHistoryDisplay();
    updatePieChart();
    updateBarChart();
    updateWordCloud();
}

// Override updateStats to also update bar chart, word cloud, confetti, and share
function updateStats(result) {
    stats.totalAnalyzed++;
    if (result.prediction === 'fake') stats.fakeDetected++;
    if (result.confidence) {
        const totalConfidence = stats.avgConfidence * (stats.totalAnalyzed - 1) + result.confidence;
        stats.avgConfidence = totalConfidence / stats.totalAnalyzed;
    }
    if (result.cached) stats.cacheHits++;
    // Add to history
    history.push({
        text: result.text || '',
        prediction: result.prediction,
        confidence: result.confidence
    });
    if (history.length > 10) history = history.slice(-10);
    // Update time trend
    const now = new Date();
    const label = now.getHours() + ':' + now.getMinutes().toString().padStart(2, '0');
    let last = timeTrend[timeTrend.length-1];
    if (!last || last.label !== label) {
        timeTrend.push({ label, real: 0, fake: 0, total: 0 });
        if (timeTrend.length > 10) timeTrend = timeTrend.slice(-10);
        last = timeTrend[timeTrend.length-1];
    }
    if (result.prediction === 'fake') last.fake++;
    else last.real++;
    last.total++;
    // Update word freq
    if (result.prediction === 'fake' && result.text) {
        result.text.toLowerCase().split(/\W+/).forEach(word => {
            if (word.length > 3) wordFreq[word] = (wordFreq[word] || 0) + 1;
        });
    }
    // Save last result for sharing
    lastResult = result;
    updateAllVisuals();
    saveStats();
    saveHistory();
    animateStat('totalAnalyzed', stats.totalAnalyzed);
    animateStat('fakeDetected', stats.fakeDetected);
    animateStat('avgConfidence', Math.round(stats.avgConfidence * 100) + '%');
    animateStat('cacheHits', stats.cacheHits);
    if (judgeMode && result.prediction === 'fake') launchConfetti();
}

// Call updateAllVisuals on load
window.addEventListener('DOMContentLoaded', updateAllVisuals);

console.log('Frauditor popup script loaded');