
// Selectors
const SELECTORS = {
    productSection: '.shopee-product-comment-list',
    reviewContent: 'meQyXP',
    imageContainer: 'ZBCPg1',
    pageController: '.shopee-page-controller.product-ratings__page-controller',
    nextButton: '.shopee-icon-button.shopee-icon-button--right',
    ratingIcon: 'icon-rating-solid'
};


const CONFIG = {
    pageDelay: 2000,       // Delay between page navigation (ms)
};

const productSection = document.querySelector(SELECTORS.productSection)
let commonClass = null
let count = 0
let final = {}

function downloadJSON() {
    try {
        const dataStr = JSON.stringify(final, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `shopee_reviews_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
        log('Reviews downloaded successfully!', 'success');
    } catch (error) {
        log(`Error downloading file: ${error.message}`, 'error');
    }
}


const getReviews = () => {
    const currentNum = Object.keys(final).length
    let reviewsParent = document.querySelectorAll(`.${commonClass}`)
    for (let i = 0; i < reviewsParent.length; i++) {
        const rev = reviewsParent[i]
        const mainContainer = rev.children[1]
        const purchaserInfoContainer = mainContainer.childNodes

        // Username, ratings and item variation/locatoin + date of purchase
        const purchaserInfoNodes = purchaserInfoContainer[0].childNodes
        const ratings = [...purchaserInfoNodes[1].childNodes[0].childNodes]
        const itemPurchaseInformationContainer = purchaserInfoNodes[2].childNodes[0].childNodes
        let itemPurchaseInformationType = ""

        if (itemPurchaseInformationContainer.length > 1) {
            itemPurchaseInformationType = "location"
        } else {
            if (itemPurchaseInformationContainer[0].textContent.split("|").length > 1) {
                itemPurchaseInformationType = "variation"
            } else {
                itemPurchaseInformationType = "dateonly"
            }
        }

        let location = ''
        let purchaseDate = ''
        let itemVariation = ''

        if (itemPurchaseInformationType == "variation") {
            let itemPurchaseInformation = itemPurchaseInformationContainer[0].textContent.split("|")
            purchaseDate = itemPurchaseInformation[0].trim()
            itemVariation = itemPurchaseInformation[1].trim()
        } else if (itemPurchaseInformationType == "location") {
            let itemPurchaseInformation = itemPurchaseInformationContainer[1].textContent.split("|")
            location = itemPurchaseInformation[0].trim()
            purchaseDate = itemPurchaseInformation[1].trim()
        } else {
            let itemPurchaseInformation = itemPurchaseInformationContainer[0].textContent
            purchaseDate = itemPurchaseInformation.trim()
        }

        // Review content
        const reviewContentContainer = [...purchaserInfoContainer].find((child) => {
            return child.className == SELECTORS.reviewContent
        })

        const hasReviewContent = reviewContentContainer ? true : false
        let subreview = {}
        let reviewContent = ""

        if (hasReviewContent) {

            const subreviewContainer = [...reviewContentContainer.childNodes[0].childNodes]
            const withSubreview = subreviewContainer.length > 0 ? true : false

            if (withSubreview) {
                subreviewContainer.map((node, j) => {
                    let subreviewText = node.textContent.split(":")
                    const subreviewCategory = subreviewText[0]
                    const subreviewContent = subreviewText[1]

                    subreview[`sub ${j}`] = {
                        category: subreviewCategory,
                        content: subreviewContent
                    }
                })
            }

            reviewContent = reviewContentContainer.childNodes[1].innerText ? reviewContentContainer.childNodes[1].innerText : ""
        }


        // Check if has image
        const imageContainer = [...purchaserInfoContainer].find((child) => {
            return child.className == SELECTORS.imageContainer
        })

        const hasImage = imageContainer ? true : false

        final[`review ${i + 1 + currentNum}`] = {
            username: purchaserInfoNodes[0].innerText || null,
            ratings: ratings.filter(rating => {
                return rating.className.baseVal.includes(SELECTORS.ratingIcon)
            }).length,
            purchase_date: purchaseDate,
            item_variation: itemVariation,
            location: location,
            subreview: subreview,
            review_content: reviewContent,
            has_image: hasImage

        }
    }

    let pageNavDiv = document.querySelector(SELECTORS.pageController)
    const pageNavButtons = [...pageNavDiv.childNodes]
    if (pageNavButtons[pageNavButtons.length - 2].innerText == "...") {
        document.querySelector(SELECTORS.nextButton).click()
        setTimeout(() => {
            getReviews()
        }, CONFIG.pageDelay);

    } else {
        if (count != 2) {
            count++
            document.querySelector(SELECTORS.nextButton).click()
            setTimeout(() => {
                getReviews()
            }, CONFIG.pageDelay);
        }
    }

    console.log(final)
}

if (productSection) {
    let firstChild = productSection.firstChild
    commonClass = firstChild.className
}

if (commonClass != null) {
    getReviews()
}
