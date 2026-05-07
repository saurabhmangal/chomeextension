// Popup script

document.addEventListener('DOMContentLoaded', () => {
  const scanButton = document.getElementById('scanTabs');
  const compareButton = document.getElementById('compare');
  const summarizeButton = document.getElementById('summarize');
  const productList = document.getElementById('productList');
  const status = document.getElementById('status');
  const progress = document.getElementById('progress');
  const progressText = document.getElementById('progress-text');
  const spinner = document.getElementById('spinner');
  const summary = document.getElementById('summary');
  const summariesDiv = document.getElementById('summaries');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveKeyButton = document.getElementById('saveKey');
  const apiKeyStatus = document.getElementById('apiKeyStatus');
  const apiSummary = document.getElementById('api-summary');

  let products = [];
  let comparePort = null;

  // ── API key persistence ──────────────────────────────────────────────────
  function setKeyIndicator(isSet) {
    if (isSet) {
      apiSummary.textContent = '⚙ API Key ✓';
      apiSummary.className = 'key-set';
    } else {
      apiSummary.textContent = '⚙ API Key — not set';
      apiSummary.className = 'key-missing';
    }
  }

  chrome.storage.sync.get('geminiApiKey', ({ geminiApiKey }) => {
    if (geminiApiKey) {
      apiKeyInput.value = geminiApiKey;
      setKeyIndicator(true);
    } else {
      setKeyIndicator(false);
      document.getElementById('api-settings').open = true;
    }
  });

  saveKeyButton.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      apiKeyStatus.textContent = 'Enter a key first.';
      apiKeyStatus.style.color = '#c62828';
      return;
    }
    chrome.storage.sync.set({ geminiApiKey: key }, () => {
      apiKeyStatus.textContent = 'Saved.';
      apiKeyStatus.style.color = '#2e7d32';
      setKeyIndicator(true);
      document.getElementById('api-settings').open = false;
      setTimeout(() => { apiKeyStatus.textContent = ''; }, 2000);
    });
  });

  function updateProgress(message) {
    if (message.type === 'progress') {
      progressText.textContent = message.text;
      spinner.style.display = 'block';
    } else if (message.type === 'result') {
      status.textContent = message.message || 'Comparison complete.';
      summary.textContent = message.summary || '';
      progressText.textContent = '';
      spinner.style.display = 'none';
      compareButton.disabled = false;
      if (comparePort) {
        comparePort.disconnect();
        comparePort = null;
      }
    } else if (message.type === 'error') {
      status.textContent = message.text || 'Error during comparison.';
      summary.textContent = '';
      progressText.textContent = '';
      spinner.style.display = 'none';
      compareButton.disabled = false;
      if (comparePort) {
        comparePort.disconnect();
        comparePort = null;
      }
    }
  }

  scanButton.addEventListener('click', async () => {
    status.textContent = 'Scanning tabs...';
    summary.textContent = '';
    summariesDiv.innerHTML = '';
    progressText.textContent = '';
    spinner.style.display = 'none';
    products = [];

    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });

    const results = await Promise.all(
      tabs.map(async (tab) => {
        try {
          const injected = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              function getText(selector) {
                return document.querySelector(selector)?.textContent?.trim() || '';
              }

              function normalize(text) {
                return text ? text.replace(/\s+/g, ' ').trim() : '';
              }

              function parseJSONLD() {
                const nodes = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                for (const node of nodes) {
                  try {
                    const data = JSON.parse(node.textContent);
                    if (Array.isArray(data)) {
                      for (const item of data) {
                        if (item['@type'] === 'Product') {
                          return item;
                        }
                      }
                    }
                    if (data['@type'] === 'Product') {
                      return data;
                    }
                    if (data['@graph']) {
                      const graphItem = Array.isArray(data['@graph'])
                        ? data['@graph'].find((item) => item['@type'] === 'Product')
                        : null;
                      if (graphItem) {
                        return graphItem;
                      }
                    }
                  } catch (e) {
                    continue;
                  }
                }
                return null;
              }

              const product = {
                name: '',
                category: '',
                price: '',
                brand: '',
                url: window.location.href,
                site: window.location.hostname,
              };

              const jsonld = parseJSONLD();
              if (jsonld) {
                product.name = normalize(product.name || jsonld.name || jsonld.headline || '');
                product.category = normalize(product.category || jsonld.category || jsonld['@type'] || '');
                product.brand = normalize(product.brand || (jsonld.brand?.name || jsonld.brand || ''));
                const price = jsonld.offers?.price || jsonld.offers?.priceSpecification?.price;
                product.price = normalize(product.price || price || '');
              }

              const candidateName =
                getText('#productTitle') ||
                getText('#titleSection h1') ||
                getText('h1') ||
                getText('.product-title') ||
                getText('[data-testid*="title"]') ||
                getText('.product-name');
              const candidatePrice =
                getText('#priceblock_ourprice') ||
                getText('#priceblock_dealprice') ||
                getText('.priceblock_ourprice') ||
                getText('.a-price .a-offscreen') ||
                getText('[data-testid*="price"]') ||
                getText('.price');
              const candidateCategory =
                getText('#wayfinding-breadcrumbs_container') ||
                Array.from(document.querySelectorAll('#wayfinding-breadcrumbs_container li span.a-list-item'))
                  .map((el) => el.textContent.trim())
                  .filter(Boolean)
                  .join(' > ') ||
                getText('.breadcrumb') ||
                getText('[data-category]');

              product.name = normalize(product.name || candidateName);
              product.price = normalize(product.price || candidatePrice);
              product.category = normalize(product.category || candidateCategory || product.category);

              const isProduct = Boolean(product.name && product.price);
              const listingElements = document.querySelectorAll(
                '[data-product-id], [data-testid*="product"], .s-result-item, .product-card, .product-item, [itemtype*="Product"]'
              );
              const isListing = !isProduct && listingElements.length >= 3;
              const pageType = isProduct ? 'product' : isListing ? 'listing' : 'other';

              return { product, isProduct, isListing, pageType };
            },
          });

          const pageData = injected?.[0]?.result;
          if (!pageData) {
            return null;
          }

          if (!pageData.isProduct && !pageData.isListing) {
            return null;
          }

          const page = {
            ...pageData.product,
            tabId: tab.id,
            title: tab.title || pageData.product.name || tab.url,
            pageType: pageData.pageType,
          };

          return page;
        } catch (e) {
          return null;
        }
      })
    );

    products = results.filter(Boolean);
    displayProducts();
    if (products.length === 0) {
      status.textContent = 'No ecommerce product or listing pages found in open tabs.';
    } else {
      status.textContent = `Found ${products.length} ecommerce pages. Select the tabs you want to compare.`;
      compareButton.disabled = false;
    }
  });

  function displayProducts() {
    productList.innerHTML = '';
    compareButton.disabled = true;

    products.forEach((product, index) => {
      const li = document.createElement('li');
      li.className = 'product-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `product-${index}`;
      checkbox.name = 'selectedProduct';
      checkbox.addEventListener('change', () => {
        const checked = productList.querySelectorAll('input[type="checkbox"]:checked').length;
        compareButton.disabled = checked < 2;
        summarizeButton.disabled = checked < 1;
      });

      const label = document.createElement('label');
      label.htmlFor = `product-${index}`;
      label.textContent = `${product.title} (${product.pageType})`;

      const meta = document.createElement('div');
      meta.className = 'product-meta';
      meta.textContent = `Category: ${product.category || 'Unknown'} | Price: ${product.price || 'N/A'} | Site: ${product.site}`;

      li.appendChild(checkbox);
      li.appendChild(label);
      li.appendChild(meta);
      productList.appendChild(li);
    });
  }

  compareButton.addEventListener('click', async () => {
    const selectedProducts = [];
    const checkboxes = productList.querySelectorAll('input[type="checkbox"]:checked');
    checkboxes.forEach((checkbox) => {
      const index = parseInt(checkbox.id.split('-')[1], 10);
      selectedProducts.push(products[index]);
    });

    if (selectedProducts.length < 2) {
      status.textContent = 'Select at least 2 product tabs to compare.';
      return;
    }

    status.textContent = 'Starting comparison...';
    progressText.textContent = '';
    spinner.style.display = 'block';
    summary.textContent = '';
    compareButton.disabled = true;

    if (comparePort) {
      comparePort.disconnect();
      comparePort = null;
    }

    comparePort = chrome.runtime.connect({ name: 'compareProgress' });
    comparePort.onMessage.addListener(updateProgress);
    comparePort.onDisconnect.addListener(() => {
      comparePort = null;
      compareButton.disabled = false;
    });

    comparePort.postMessage({
      action: 'invokeTool',
      toolName: 'compareProductsWithProgress',
      params: { products: selectedProducts },
    });
  });

  summarizeButton.addEventListener('click', () => {
    const selectedProducts = [];
    productList.querySelectorAll('input[type="checkbox"]:checked').forEach((cb) => {
      selectedProducts.push(products[parseInt(cb.id.split('-')[1], 10)]);
    });

    if (selectedProducts.length < 1) {
      status.textContent = 'Select at least one product to summarize.';
      return;
    }

    status.textContent = 'Summarizing…';
    spinner.style.display = 'block';
    progressText.textContent = `Calling Gemini for ${selectedProducts.length} product(s)…`;
    summariesDiv.innerHTML = '';
    summarizeButton.disabled = true;

    chrome.runtime.sendMessage(
      { action: 'summarizeProducts', products: selectedProducts },
      (response) => {
        spinner.style.display = 'none';
        progressText.textContent = '';
        summarizeButton.disabled = false;

        if (!response || !response.success) {
          status.textContent = 'Summarization failed — check your API key.';
          return;
        }

        status.textContent = `Summarized ${Object.keys(response.summaries).length} product(s).`;
        Object.entries(response.summaries).forEach(([name, text]) => {
          const card = document.createElement('div');
          card.className = 'summary-card';

          const title = document.createElement('div');
          title.className = 'summary-card-title';
          title.textContent = name;

          const body = document.createElement('div');
          body.className = 'summary-card-body';
          body.textContent = text;

          card.appendChild(title);
          card.appendChild(body);
          summariesDiv.appendChild(card);
        });
      }
    );
  });
});