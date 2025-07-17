chrome.action.onClicked.addListener((tab) => {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
    });
});

async function getValidity() {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(true);
        }, 5000);
    });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "initFraudDetection") {
        console.log("Div in view message received!");

        (async () => {
            let results = await getValidity();
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "validityResults",
                    data: results
                });
            }
            sendResponse({ status: "✅ sent to content script" });
        })();

        return true; // 🚨 IMPORTANT: keep sendResponse valid
    }
});
