chrome.action.onClicked.addListener((tab) => {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
    });
});

async function getValidity(reviews) {
    const response = await fetch("http://localhost:8000/api/reviews/submit-reviews", {
        method: "POST",
        body: JSON.stringify(reviews)
    })

    return await response.json()
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "initFraudDetection") {
        (async () => {
            let results = await getValidity(msg.data);

            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "validityResults",
                    data: results
                });
            }
            sendResponse({ status: "Sent to content script" });
        })();

        return true;
    }
});
