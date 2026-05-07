// Background script for E-Commerce Product Comparator

// Store detected products
let detectedProducts = [];

async function getApiKey() {
  const { geminiApiKey } = await chrome.storage.sync.get('geminiApiKey');
  return geminiApiKey || null;
}

function normalizeText(value) {
  return value ? value.toString().toLowerCase().replace(/\s+/g, ' ').trim() : '';
}

function getKeywords(text) {
  if (!text) return [];
  const normalized = normalizeText(text);
  const separators = /[\|>\/-:,]+/;
  const tokens = normalized
    .split(separators)
    .flatMap((segment) => segment.split(' '))
    .map((value) => value.trim())
    .filter(Boolean);

  const stopwords = new Set(['and', 'or', 'the', 'with', 'for', 'home', 'office', 'kitchen', 'furniture', 'appliances', 'large', 'small', 'new']);
  return tokens.filter((token) => token.length > 2 && !stopwords.has(token));
}

function getProductTypeTokens(product) {
  const fields = [product.category, product.name, product.title, product.site];
  const keywords = fields.flatMap(getKeywords);
  const deduped = Array.from(new Set(keywords));
  return deduped;
}

function hasSharedProductType(product1, product2) {
  const typeTokens1 = getProductTypeTokens(product1);
  const typeTokens2 = getProductTypeTokens(product2);
  const shared = typeTokens1.filter((token) => typeTokens2.includes(token));
  return shared.length > 0 ? shared : [];
}

async function tool_callGemini({ prompt }) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return null;
  }

  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      maxOutputTokens: 256
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Gemini API error:', error);
    return null;
  }
}

// Compare two products using local heuristics with Gemini fallback for detail
async function tool_compareProductPair({ product1, product2 }) {
  const sharedTokens = hasSharedProductType(product1, product2);
  if (sharedTokens.length > 0) {
    return {
      comparable: true,
      reason: `Shared keywords: ${sharedTokens.join(', ')}`,
      source: 'heuristic',
      tokens: sharedTokens,
    };
  }

  const prompt = `Determine if these two products are in the same category and thus comparable for a product comparison. Products should be comparable if they are the same type of item (e.g., Samsung TV and LG TV are comparable, but TV and Mobile are not). Do not compare products in different categories.

Product 1:\nName: ${product1.name || product1.title || 'Unknown'}\nCategory: ${product1.category || 'Unknown'}\nURL: ${product1.url}
Product 2:\nName: ${product2.name || product2.title || 'Unknown'}\nCategory: ${product2.category || 'Unknown'}\nURL: ${product2.url}

Answer with only "yes" or "no", then include a short reason.`;

  const response = await invokeTool('callGemini', { prompt });
  if (response) {
    const normalized = normalizeText(response);
    if (normalized.match(/(^|\W)yes(\W|$)/)) {
      return {
        comparable: true,
        reason: `LLM says yes: ${response.trim()}`,
        source: 'LLM',
      };
    }
    if (normalized.match(/(^|\W)no(\W|$)/)) {
      return {
        comparable: false,
        reason: `LLM says no: ${response.trim()}`,
        source: 'LLM',
      };
    }
    return {
      comparable: false,
      reason: `LLM unclear response: ${response.trim()}`,
      source: 'LLM',
    };
  }

  return {
    comparable: false,
    reason: 'No shared keywords and LLM unavailable or failed.',
    source: 'fallback',
  };
}

function tool_generateCsv({ products }) {
  if (products.length === 0) return '';

  const headers = Object.keys(products[0]);
  const csvRows = [headers.join(',')];

  for (const product of products) {
    const values = headers.map(header => `"${product[header] || ''}"`);
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

function tool_downloadCsv({ csvContent, filename }) {
  const encoded = encodeURIComponent(csvContent);
  const url = `data:text/csv;charset=utf-8,${encoded}`;
  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: true
  });
}

function tool_generateComparisonSummary({ products, pairDetails, comparableProducts }) {
  const summaryLines = [];
  summaryLines.push(`Selected products: ${products.length}`);
  summaryLines.push(`Compared pairs: ${pairDetails.length}`);
  summaryLines.push('');

  pairDetails.forEach((pair, index) => {
    summaryLines.push(`Pair ${index + 1}:`);
    summaryLines.push(`  Product A: ${pair.productA.name || pair.productA.title || pair.productA.url}`);
    summaryLines.push(`  Product B: ${pair.productB.name || pair.productB.title || pair.productB.url}`);
    summaryLines.push(`  Comparable: ${pair.comparable ? 'Yes' : 'No'}`);
    summaryLines.push(`  Reason: ${pair.reason}`);
    summaryLines.push(`  Source: ${pair.source}`);
    summaryLines.push('');
  });

  if (comparableProducts.length > 0) {
    comparableProducts.forEach((product) => {
      product.comparisonGroup = product.category || 'Same category';
    });

    summaryLines.unshift(`Comparable products: ${comparableProducts.length}`);
    const categoryGroups = {};
    comparableProducts.forEach((product) => {
      const category = product.comparisonGroup;
      categoryGroups[category] = categoryGroups[category] || [];
      categoryGroups[category].push(product.name || product.title || product.url);
    });

    Object.entries(categoryGroups).forEach(([category, names]) => {
      summaryLines.push(`Category group: ${category} (${names.length})`);
      names.forEach((name) => summaryLines.push(`  - ${name}`));
    });
  } else {
    summaryLines.unshift('Comparable products: 0');
  }

  return summaryLines.join('\n');
}

function tool_compareProductsWithProgress({ products, port }) {
  return compareProductsWithProgress(products, port);
}

// PURE LLM CALL — calls tool_callGemini directly, bypasses invokeTool dispatcher.
// Compare with compareProductPair which goes through invokeTool('callGemini', ...).
async function summarizeProduct(product) {
  const name = product.name || product.title || 'Unknown product';
  const prompt = `You are a shopping assistant. Write a 2–3 sentence summary of this product for someone comparison-shopping.

Product: ${name}
Price: ${product.price || 'N/A'}
Category: ${product.category || 'N/A'}
Site: ${product.site || product.url}

Describe what it is, what stands out, and who it suits. Be direct.`;

  return await tool_callGemini({ prompt });
}

async function tool_summarizeProducts({ products }) {
  const summaries = {};
  for (const product of products) {
    const key = product.name || product.title || product.url;
    summaries[key] = (await summarizeProduct(product)) ?? 'Summary unavailable (API key not set).';
  }
  return summaries;
}

const tools = {
  callGemini: tool_callGemini,
  compareProductPair: tool_compareProductPair,
  compareProductsWithProgress: tool_compareProductsWithProgress,
  generateCsv: tool_generateCsv,
  downloadCsv: tool_downloadCsv,
  generateComparisonSummary: tool_generateComparisonSummary,
  summarizeProducts: tool_summarizeProducts,
};

async function invokeTool(toolName, params = {}) {
  const tool = tools[toolName];
  if (!tool) {
    throw new Error(`Tool not found: ${toolName}`);
  }
  return await tool(params);
}

async function compareProductsWithProgress(products, port) {
  const comparableProducts = [];
  const pairDetails = [];
  const totalPairs = (products.length * (products.length - 1)) / 2;
  let currentPair = 0;
  let currentStep = 0;
  const totalSteps = totalPairs + 1; // +1 for final processing

  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      currentPair += 1;
      currentStep += 1;
      const productA = products[i];
      const productB = products[j];
      port.postMessage({
        type: 'progress',
        text: `Step ${currentStep} of ${totalSteps}: Comparing pair ${currentPair} of ${totalPairs}: ${productA.name || productA.title || 'Product'} vs ${productB.name || productB.title || 'Product'}`,
      });

      const comparison = await invokeTool('compareProductPair', { product1: productA, product2: productB });
      pairDetails.push({
        productA,
        productB,
        comparable: comparison.comparable,
        reason: comparison.reason,
        source: comparison.source,
      });

      if (comparison.comparable) {
        if (!comparableProducts.find(p => p.url === productA.url)) comparableProducts.push(productA);
        if (!comparableProducts.find(p => p.url === productB.url)) comparableProducts.push(productB);
      }
    }
  }

  currentStep += 1;
  port.postMessage({
    type: 'progress',
    text: `Step ${currentStep} of ${totalSteps}: Generating CSV and summary...`,
  });

  if (comparableProducts.length > 0) {
    comparableProducts.forEach((product) => {
      product.comparisonGroup = product.category || 'Same category';
    });

    const csv = await invokeTool('generateCsv', { products: comparableProducts });
    invokeTool('downloadCsv', { csvContent: csv, filename: 'product_comparison.csv' });
  }

  const summary = await invokeTool('generateComparisonSummary', {
    products,
    pairDetails,
    comparableProducts,
  });

  port.postMessage({
    type: 'result',
    message: `Comparison finished with ${comparableProducts.length} comparable products.`,
    summary,
  });
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'compareProgress') {
    return;
  }

  port.onMessage.addListener((request) => {
    if (request.action === 'invokeTool' && request.toolName === 'compareProductsWithProgress' && Array.isArray(request.params?.products)) {
      invokeTool('compareProductsWithProgress', { products: request.params.products, port }).catch((error) => {
        console.error('Tool compareProductsWithProgress error:', error);
        port.postMessage({ type: 'error', text: 'Error comparing products via tool.' });
      });
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'summarizeProducts') {
    tool_summarizeProducts({ products: request.products })
      .then((summaries) => sendResponse({ success: true, summaries }))
      .catch((err) => {
        console.error('Summarization error:', err);
        sendResponse({ success: false });
      });
    return true;
  } else if (request.action === 'getDetectedProducts') {
    sendResponse({ products: detectedProducts });
  } else if (request.action === 'productDetected') {
    const existing = detectedProducts.find(p => p.url === request.product.url);
    if (!existing) {
      detectedProducts.push(request.product);
    }
  }
});