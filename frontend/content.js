const CONTENT_SELECTORS = {
    productCommentList: ".shopee-product-comment-list",
    navigationBar: ".shopee-page-controller.product-ratings__page-controller"
}

const observer = new MutationObserver((mutations, obs) => {
    const target = document.querySelector(CONTENT_SELECTORS.productCommentList);
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

function createBadgeContent(message, confidence = null, details = null, status = 'loading') {
    const badge = document.createElement("div");
    // const statusIcon = document.createElement("div");
    // statusIcon.className = "status-icon";
    // badge.appendChild(statusIcon);

    // Text and confidence bar container
    const textContainer = document.createElement("div");
    textContainer.style.display = "flex";
    textContainer.style.flexDirection = "column";
    textContainer.style.alignItems = "center";
    textContainer.style.justifyContent = "center";
    textContainer.style.gap = "2px";

    const text = document.createElement("span");
    text.classList = "text-formatting"
    text.textContent = message;
    text.style.fontWeight = "600";
    text.style.fontSize = "13px";
    text.style.textAlign = "center";
    textContainer.appendChild(text);

    if (confidence !== null && status !== 'loading') {
        const confidenceBar = document.createElement("div");
        confidenceBar.className = "confidence-bar";
        const fill = document.createElement("div");
        fill.className = "confidence-bar-fill";
        fill.style.width = `${confidence}%`;
        confidenceBar.appendChild(fill);
        textContainer.appendChild(confidenceBar);

        const tooltip = document.createElement("div");
        tooltip.className = "tooltip";

        // Enhanced tooltip content
        let tooltipContent = `Confidence: ${confidence}%<br>`;
        if (details && details.analysis) {
            tooltipContent += `
                <br>Analysis Details:<br>
                - Sentiment Score: ${(details.analysis.sentiment_score * 100).toFixed(1)}%<br>
                - Quality Score: ${details.analysis.quality_score}/100<br>
                - Malaysian Terms: ${details.analysis.malaysian_terms || 0}<br>
                - Processing Time: ${(details.prediction_time * 1000).toFixed(0)}ms
            `;
        }
        tooltip.innerHTML = tooltipContent;
        badge.appendChild(tooltip);
    }

    badge.appendChild(textContainer);
    return badge;
}

function injectIntoTarget(target, message, uniqueIdentifier, hasExistingDiv = false, details = null, status = 'loading') {
    if (document.getElementById(uniqueIdentifier) && !hasExistingDiv) {
        return;
    }
    target.style.position = "relative";

    if (hasExistingDiv) {
        const boxToModify = document.getElementById(uniqueIdentifier);
        if (boxToModify) {
            const [prediction, confidenceStr] = message.split(",");
            const confidence = parseFloat(confidenceStr.match(/[\d.]+/)[0]);
            let statusType = 'real';
            if (prediction.trim().toUpperCase() === "REAL") statusType = 'real';
            else if (prediction.trim().toUpperCase() === "FAKE") statusType = 'fake';
            else statusType = 'unknown';
            boxToModify.innerHTML = "";
            boxToModify.appendChild(createBadgeContent(prediction, confidence, details, statusType));
            if (statusType === 'real') {
                boxToModify.className = "injected-class nfraud";
            } else if (statusType === 'fake') {
                boxToModify.className = "injected-class yfraud";
            } else {
                boxToModify.className = "injected-class";
            }
            boxToModify.classList.add("fade-in");
            setTimeout(() => boxToModify.classList.remove("fade-in"), 1000);
        }
        return;
    }
    const injectBox = document.createElement("div");
    injectBox.id = uniqueIdentifier;
    injectBox.className = "injected-class loading";

    const spinner = document.createElement("img");
    spinner.src = chrome.runtime.getURL("assets/spinner.gif");
    spinner.alt = "Analyzing...";
    spinner.className = "loading-spinner";
    spinner.style.width = "20px";
    spinner.style.height = "20px";

    const loadingContainer = document.createElement("div");
    loadingContainer.style.display = "flex";
    loadingContainer.style.flexDirection = "column";
    loadingContainer.style.gap = "4px";
    loadingContainer.style.padding = "2px"

    const loadingText = document.createElement("span");
    loadingText.textContent = "Analyzing review...";

    // const loadingSubtext = document.createElement("span");
    // loadingSubtext.style.fontSize = "10px";
    // loadingSubtext.style.opacity = "0.8";
    // loadingSubtext.textContent = "Checking authenticity patterns";

    loadingContainer.appendChild(loadingText);
    // loadingContainer.appendChild(loadingSubtext);

    // injectBox.appendChild(spinner);
    injectBox.appendChild(loadingContainer);
    target.appendChild(injectBox);
}

async function processComments() {
    console.log("Processing comments");
    const target = document.querySelector(CONTENT_SELECTORS.productCommentList);
    let sameComments = false;

    if (target) {
        [...target.childNodes].forEach((node, i) => {
            const injectionTarget = node.childNodes[1];
            if (!injectionTarget) return;

            if (injectionTarget.lastChild.classList.contains("injected-class")) {
                sameComments = true;
            }

            injectIntoTarget(injectionTarget, "loading...", `b${i + 1}`);
        });

        if (sameComments) return;

        detectCommonClass()

        try {
            let data = await getReviews();
            console.log("Reviews fetched:", data);
            const res = await chrome.runtime.sendMessage({
                action: "initFraudDetection",
                data: data
            });
        } catch (error) {
            console.error("Error processing comments:", error);
            // Show error state in UI
            [...target.childNodes].forEach((node, i) => {
                const injectionTarget = node.childNodes[1];
                if (!injectionTarget) return;

                const errorBox = document.getElementById(`b${i + 1}`);
                if (errorBox) {
                    errorBox.className = "injected-class error";
                    errorBox.innerHTML = "";
                    errorBox.appendChild(createBadgeContent("Analysis failed"));
                }
            });
        }
    }
}

function observeElement(el) {
    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                console.log("Review section is in view");
                processComments();
            }
        });
    });
    io.observe(el);

    // Mutation Observer for pagination changes by tracking opacity changes
    const ratingsObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' &&
                mutation.attributeName === 'style' &&
                mutation.target.classList.contains('product-ratings__list')) {

                const currentOpacity = mutation.target.style.opacity;
                console.log("Opacity changed to:", currentOpacity);

                // When opacity changes from 1 to another value, pagination is happening
                if (currentOpacity !== '1') {
                    console.log("Pagination detected - waiting for completion...");

                    // Wait for opacity to return to 1 (pagination complete)
                    const completionObserver = new MutationObserver((completionMutations) => {
                        completionMutations.forEach((completionMutation) => {
                            if (completionMutation.type === 'attributes' &&
                                completionMutation.attributeName === 'style' &&
                                completionMutation.target.style.opacity === '1') {

                                console.log("Pagination completed - processing comments");
                                setTimeout(() => {
                                    processComments();
                                }, 200); // Small delay to ensure content is fully loaded

                                completionObserver.disconnect();
                            }
                        });
                    });

                    completionObserver.observe(mutation.target, {
                        attributes: true,
                        attributeFilter: ['style']
                    });
                }
            }
        });
    });

    // Find and observe the product-ratings__list element
    const ratingsTarget = document.querySelector('.product-ratings__list');
    if (ratingsTarget) {
        ratingsObserver.observe(ratingsTarget, {
            attributes: true,
            attributeFilter: ['style']
        });
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action == "validityResults") {
        const target = document.querySelector(".shopee-product-comment-list");
        [...target.childNodes].forEach((node, i) => {
            const injectionTarget = node.childNodes[1];
            const receivedData = request.data.predictions;
            const key = `review ${i + 1}`;

            const confidence = Number(receivedData.predictions[key].confidence * 100);
            const prediction = receivedData.predictions[key].prediction;
            const message = `${prediction}, Confidence level: ${Math.round((confidence + Number.EPSILON) * 100) / 100}%`;

            injectIntoTarget(
                injectionTarget,
                message,
                `b${i + 1}`,
                true,
                receivedData.predictions[key]
            );
        });
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

injectCSS();
