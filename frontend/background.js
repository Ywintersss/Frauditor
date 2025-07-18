const ENV = {
    MODE: "prod",
    API_URL: "https://frauditor.onrender.com"
}

async function getValidity(reviews) {
    const response = await fetch(`${ENV.API_URL}/api/reviews/submit-reviews`, {
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
