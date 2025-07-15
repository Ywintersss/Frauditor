const observer = new MutationObserver((mutations, obs) => {
    const target = document.querySelector(".shopee-product-comment-list");
    if (target) {
        obs.disconnect();
        observeElement(target);
    }
});

function injectCSS() {
    const cssUrl = chrome.runtime.getURL("styles/injected.css");

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = cssUrl;

    document.head.appendChild(link);
}

function injectIntoTarget(target, message, uniqueIdentifier, hasExistingDiv = false) {
    injectCSS()

    if (hasExistingDiv) {
        const boxToModify = document.getElementById(`b${uniqueIdentifier}`);
        boxToModify.innerText = message;
        // check result type
        boxToModify.classList = "injected-class nfraud"

        return;
    }
    target.style.position = "relative";

    const injectBox = document.createElement("div");
    injectBox.id = `b${uniqueIdentifier}`
    injectBox.classList = "injected-class loading-check";
    injectBox.innerText = message;

    target.appendChild(injectBox);
}

function observeElement(el) {
    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                console.log("Review section is in view");
                (async () => {
                    const res = await chrome.runtime.sendMessage({ action: "initFraudDetection" })
                    console.log(res)
                })();

                [...entry.target.childNodes].map((node, i) => {
                    injectIntoTarget(node.childNodes[1], "haven't load", i);
                });
            }
        });
    });
    io.observe(el);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action == "validityResults") {
        const target = document.querySelector(".shopee-product-comment-list");
        [...target.childNodes].map((node, i) => {
            injectIntoTarget(node.childNodes[1], "loaded", i, true);
        })
    }
});


observer.observe(document.body, {
    childList: true,
    subtree: true
});
