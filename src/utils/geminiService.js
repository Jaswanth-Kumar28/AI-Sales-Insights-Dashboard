import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Service to manage Google Gemini API calls client-side.
 */

// Format the compiled metrics into a condensed JSON summary for prompt context
export function prepareDataSummary(processedData) {
  if (!processedData) return "";
  
  const { metrics, trendData, rankedProducts, categoryPieData, regionalMetrics } = processedData;

  // We only send top 10 and bottom 5 products to save tokens and prevent clutter
  const topProducts = rankedProducts.slice(0, 10);
  const bottomProducts = rankedProducts.length > 5 ? rankedProducts.slice(-5) : rankedProducts;

  return JSON.stringify({
    generalMetrics: metrics,
    salesTrendOverTime: trendData,
    topProductsByRevenue: topProducts,
    underperformingProducts: bottomProducts,
    categoryBreakdown: categoryPieData,
    regionalPerformance: regionalMetrics
  }, null, 2);
}

/**
 * Generates an executive sales audit report.
 */
export async function generateSalesAuditReport(apiKey, processedData, modelName = "gemini-1.5-flash") {
  if (!apiKey) throw new Error("API Key is missing.");
  if (!processedData) throw new Error("No sales data available for analysis.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  const dataSummary = prepareDataSummary(processedData);

  const prompt = `
You are an expert Chief Financial Officer (CFO) and senior business consultant.
Below is an aggregated JSON summary of our business's sales performance over the past 6 months.

\`\`\`json
${dataSummary}
\`\`\`

Write a comprehensive, professional, and actionable Sales Performance & Insights Audit Report.
Your report should be polished, highly detailed, and tailored to a business owner who wants clear facts, trends, and strategic solutions.

Use the following structure for your report:

# Executive Performance Audit
- Give a high-level review of the total revenue, transaction counts, and Average Order Value (AOV).
- Provide a summary of the general health of the business. Highlight whether the trend is expanding, stable, or contracting.

# Top Performance Drivers (Categories & Products)
- Analyze the most successful product categories and specific star items.
- Explain *why* these items might be driving success (based on their metrics, quantities, unit prices).
- Recommend expansion strategies for these products (e.g., bundling, cross-selling, pricing adjustments).

# Declining & Underperforming Products
- Identify the bottom products by sales and volume.
- Spot any specific alarming trends (like declining sales, low volume of highly priced products, etc.).
- Propose remedial actions for each (e.g., discount promotions, clear-out sales, restocking adjustments, or supplier renegotiation).

# Territory & Regional Vulnerabilities (Weak Areas)
- Detail the performance across regions. Highlight the strongest and the weakest region.
- Analyze the underperforming regions: list potential root causes (e.g. marketing deficit, local competition, logistics, stocking issues) and suggest concrete, regional turn-around strategies.

# Actionable Strategic Roadmap (3-Month Plan)
- Provide a clear, prioritized 3-month action plan.
- Month 1: Immediate cost-saving or quick-revenue fixes.
- Month 2: Product adjustments, pricing shifts, or marketing campaigns.
- Month 3: Regional expansion, scaling successful models, or long-term growth.

Format requirements:
- Use clean, premium GitHub-flavored markdown.
- Use bolding, clean bullet points, tables, and short paragraphs for scannability.
- Avoid generic filler. Reference the exact numbers and percentages from the dataset.
- Be highly professional, realistic, and analytical.
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini API Error (Report):", error);
    throw new Error(error.message || "Failed to generate report using Gemini API.", { cause: error });
  }
}

/**
 * Handles custom queries inside the interactive AI Chat Consultant.
 */
export async function chatWithConsultant(apiKey, processedData, chatHistory, userMessage, modelName = "gemini-1.5-flash") {
  if (!apiKey) throw new Error("API Key is missing.");
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  
  const dataSummary = processedData ? prepareDataSummary(processedData) : "No sales data uploaded yet.";

  // Format history for Gemini API:
  // Gemini's standard format requires role: 'user' or 'model'
  const formattedHistory = chatHistory.map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));

  // Setup system context and active question
  const systemInstruction = `
You are the business's dedicated virtual AI Sales Consultant and CFO.
Your job is to answer the owner's questions about their sales performance using the data below:

\`\`\`json
${dataSummary}
\`\`\`

Rules for your answers:
1. Always remain strictly grounded in the business data provided. Use the exact numbers (revenue, quantities, products, categories, regions) when answering.
2. If asked about something not in the data, try to relate it to standard business advice, but explicitly state that it's standard guidance and not directly calculated from their uploaded sheet.
3. Be highly professional, encouraging, practical, and detail-oriented.
4. Format your replies in clean markdown, using bold titles, lists, and tables where appropriate. Keep your answers concise, engaging, and focused on solutions.
`;

  try {
    const chat = model.startChat({
      history: formattedHistory,
      systemInstruction: systemInstruction
    });

    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini API Error (Chat):", error);
    throw new Error(error.message || "Failed to send message to Gemini API.", { cause: error });
  }
}
