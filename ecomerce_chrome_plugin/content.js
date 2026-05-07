// Content script to extract product information

function normalize(text) {
  return text ? text.replace(/\s+/g, ' ').trim() : '';
}

function parseJSONLDProduct() {
  const nodes = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  for (const node of nodes) {
    try {
      const data = JSON.parse(node.textContent);
      if (Array.isArray(data)) {
        const item = data.find((entry) => entry['@type'] === 'Product');
        if (item) return item;
      }
      if (data['@type'] === 'Product') {
        return data;
      }
      if (data['@graph']) {
        const graph = Array.isArray(data['@graph']) ? data['@graph'] : [data['@graph']];
        const item = graph.find((entry) => entry['@type'] === 'Product');
        if (item) return item;
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

function extractProductInfo() {
  const product = {
    name: '',
    category: '',
    price: '',
    brand: '',
    url: window.location.href,
    site: window.location.hostname,
  };

  const jsonld = parseJSONLDProduct();
  if (jsonld) {
    product.name = normalize(product.name || jsonld.name || jsonld.headline || '');
    product.category = normalize(product.category || jsonld.category || jsonld['@type'] || '');
    product.brand = normalize(product.brand || (jsonld.brand?.name || jsonld.brand || ''));
    const price = jsonld.offers?.price || jsonld.offers?.priceSpecification?.price;
    product.price = normalize(product.price || price || '');
  }

  const fallbackName =
    normalize(document.querySelector('#productTitle')?.textContent) ||
    normalize(document.querySelector('#titleSection h1')?.textContent) ||
    normalize(document.querySelector('h1')?.textContent) ||
    normalize(document.querySelector('.product-title')?.textContent) ||
    normalize(document.querySelector('[data-testid*="title"]')?.textContent) ||
    normalize(document.querySelector('.product-name')?.textContent);

  const fallbackPrice =
    normalize(document.querySelector('#priceblock_ourprice')?.textContent) ||
    normalize(document.querySelector('#priceblock_dealprice')?.textContent) ||
    normalize(document.querySelector('.a-price .a-offscreen')?.textContent) ||
    normalize(document.querySelector('[data-testid*="price"]')?.textContent) ||
    normalize(document.querySelector('.price')?.textContent);

  const fallbackCategory =
    normalize(document.querySelector('#wayfinding-breadcrumbs_container')?.textContent) ||
    normalize(Array.from(document.querySelectorAll('#wayfinding-breadcrumbs_container li span.a-list-item')).map((el) => el.textContent).join(' > ')) ||
    normalize(document.querySelector('.breadcrumb')?.textContent) ||
    normalize(document.querySelector('[data-category]')?.textContent);

  product.name = normalize(product.name || fallbackName);
  product.price = normalize(product.price || fallbackPrice);
  product.category = normalize(product.category || fallbackCategory || 'Unknown');

  return product;
}

function detectPageType(product) {
  const hasProduct = Boolean(product.name && product.price);
  const listingElements = document.querySelectorAll('[data-product-id], [data-testid*="product"], .s-result-item, .product-card, .product-item, [itemtype*="Product"]');
  const hasListing = !hasProduct && listingElements.length >= 3;
  return hasProduct ? 'product' : hasListing ? 'listing' : 'other';
}

window.addEventListener('load', () => {
  const product = extractProductInfo();
  if (product.name && product.price) {
    chrome.runtime.sendMessage({ action: 'productDetected', product: product });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractProduct' || request.action === 'detectPage') {
    const product = extractProductInfo();
    const pageType = detectPageType(product);
    sendResponse({ product, pageType, isProduct: pageType === 'product', isListing: pageType === 'listing' });
  }
});