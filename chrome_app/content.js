/**
 * Content script to extract page insights and wallpapers
 */

// Function to extract summary content
function extractPageContent() {
    const title = document.title;
    const headings = Array.from(document.querySelectorAll('h1, h2')).map(h => h.innerText.trim());
    const paragraphs = Array.from(document.querySelectorAll('p'))
        .map(p => p.innerText.trim())
        .filter(text => text.length > 50)
        .slice(0, 5); // Take top 5 paragraphs

    return {
        title,
        headings: headings.slice(0, 3),
        paragraphs
    };
}

// Function to find high-res images
function findHighResImages() {
    const images = Array.from(document.querySelectorAll('img'));
    const results = [];

    images.forEach(img => {
        // Use naturalWidth/Height to get actual resolution
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        const src = img.src;

        // Skip small images or tracking pixels
        if (width < 300 || height < 300) return;

        // Eligibility check (HD+ or large aspect ratio)
        const isEligible = width >= 1920 && height >= 1080;
        
        results.push({
            src,
            width,
            height,
            isEligible
        });
    });

    // Also look for background images in large containers
    const allElements = document.querySelectorAll('div, section, header');
    allElements.forEach(el => {
        const bg = window.getComputedStyle(el).backgroundImage;
        if (bg && bg !== 'none' && bg.startsWith('url')) {
            const url = bg.slice(5, -2);
            // We can't easily get dimensions of BG images without loading them
            // For now, we'll just track them if the container is large
            if (el.offsetWidth > 1000) {
                results.push({
                    src: url,
                    width: el.offsetWidth,
                    height: el.offsetHeight,
                    isEligible: el.offsetWidth >= 1920,
                    isBg: true
                });
            }
        }
    });

    return results;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "analyzePage") {
        sendResponse({
            content: extractPageContent(),
            images: findHighResImages()
        });
    }
});
