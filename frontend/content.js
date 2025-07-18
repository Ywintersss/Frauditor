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

function injectIntoTarget(target, message, uniqueIdentifier, hasExistingDiv = false) {
    if (document.getElementById(uniqueIdentifier) && !hasExistingDiv) {
        return;
    }
    if (hasExistingDiv) {
        const messageType = message.split(",")[0]
        const boxToModify = document.getElementById(uniqueIdentifier);
        if (boxToModify) {
            boxToModify.innerText = message;
            if (messageType == "REAL") {
                boxToModify.classList = "injected-class nfraud"
            } else {
                boxToModify.classList = "injected-class yfraud"
            }
        }
        return;
    }
    target.style.position = "relative";

    const injectBox = document.createElement("div");
    const spinner = document.createElement("img");

    injectBox.id = uniqueIdentifier;
    injectBox.classList = "injected-class";

    spinner.src = chrome.runtime.getURL("assets/spinner.gif");
    spinner.alt = "Loading...";
    spinner.style.width = "30px";
    spinner.style.height = "30px";
    spinner.style.marginLeft = "8px";

    injectBox.appendChild(spinner);
    target.appendChild(injectBox);
}

async function processComments() {
    console.log("Processing comments");
    const target = document.querySelector(CONTENT_SELECTORS.productCommentList);
    let sameComments = false;
    if (target) {
        [...target.childNodes].map((node, i) => {
            const injectionTarget = node.childNodes[1];
            if (!injectionTarget) return;

            // Checks if the comments changed from pagination or not 
            if (injectionTarget.lastChild.classList.contains("injected-class")) {
                sameComments = true;
            }

            injectIntoTarget(injectionTarget, "loading...", `b${i + 1}`);
        });

        detectCommonClass();

        if (sameComments) {
            return;
        }

        let data = await getReviews();
        console.log(data)

        const res = await chrome.runtime.sendMessage({ action: "initFraudDetection", data: data })
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
        [...target.childNodes].map((node, i) => {
            const injectionTarget = node.childNodes[1]
            const receivedData = request.data;
            const key = `review ${i + 1}`

            const confidence = Number(receivedData.predictions[key].confidence * 100)
            const prediction = receivedData.predictions[key].prediction
            const message = `${prediction}, Confidence level: ${Math.round((confidence + Number.EPSILON) * 100) / 100}%`

            injectIntoTarget(injectionTarget, message, `b${i + 1}`, true);
        })
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});
injectCSS()
