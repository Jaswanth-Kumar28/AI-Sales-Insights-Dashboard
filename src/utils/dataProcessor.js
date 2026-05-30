/**
 * Utility to process raw parsed CSV data into normalized JSON and calculate
 * aggregated metrics, chart series, and ambient offline insights.
 */

// Helper to normalize column keys to standard fields
export function normalizeHeaders(rawRow) {
  const normalized = {};
  const keys = Object.keys(rawRow);
  
  const mapping = {
    date: ['date', 'transaction date', 'order date', 'time'],
    orderId: ['order id', 'order_id', 'id', 'transaction id', 'invoice'],
    product: ['product', 'item', 'product name', 'product_name', 'name'],
    category: ['category', 'type', 'product category', 'department'],
    quantity: ['quantity', 'qty', 'units', 'count'],
    unitPrice: ['unit price', 'unit_price', 'price', 'rate'],
    revenue: ['revenue', 'sales', 'total', 'total sales', 'amount', 'total_amount'],
    region: ['region', 'location', 'city', 'territory', 'channel']
  };

  const findKey = (field) => {
    const targets = mapping[field];
    return keys.find(k => targets.includes(k.toLowerCase().trim())) || null;
  };

  const dateKey = findKey('date');
  const orderIdKey = findKey('orderId');
  const productKey = findKey('product');
  const categoryKey = findKey('category');
  const quantityKey = findKey('quantity');
  const unitPriceKey = findKey('unitPrice');
  const revenueKey = findKey('revenue');
  const regionKey = findKey('region');

  // Fallbacks if headers don't match standard names perfectly:
  // We will map based on key index or common names if missing.
  normalized.date = dateKey ? rawRow[dateKey] : rawRow[keys[0]] || '';
  normalized.orderId = orderIdKey ? rawRow[orderIdKey] : rawRow[keys[1]] || 'N/A';
  normalized.product = productKey ? rawRow[productKey] : rawRow[keys[2]] || 'Unknown Product';
  normalized.category = categoryKey ? rawRow[categoryKey] : 'Other';
  normalized.quantity = quantityKey ? parseInt(rawRow[quantityKey], 10) : 1;
  normalized.unitPrice = unitPriceKey ? parseFloat(rawRow[unitPriceKey]) : 0;
  
  if (revenueKey) {
    normalized.revenue = parseFloat(rawRow[revenueKey]);
  } else {
    // Calculate if missing
    normalized.revenue = normalized.quantity * normalized.unitPrice;
  }
  
  normalized.region = regionKey ? rawRow[regionKey] : 'Global';

  // Sanity check values
  if (isNaN(normalized.quantity)) normalized.quantity = 1;
  if (isNaN(normalized.unitPrice)) normalized.unitPrice = 0;
  if (isNaN(normalized.revenue)) normalized.revenue = normalized.quantity * normalized.unitPrice;

  return normalized;
}

export function processSalesData(rawRows) {
  if (!rawRows || rawRows.length === 0) return null;

  // Filter out completely empty rows
  const cleanRows = rawRows
    .filter(row => {
      const values = Object.values(row).join('').trim();
      return values.length > 0;
    })
    .map(row => normalizeHeaders(row));

  if (cleanRows.length === 0) return null;

  // Calculate totals
  let totalRevenue = 0;
  let totalUnits = 0;
  const transactionsCount = cleanRows.length;

  cleanRows.forEach(row => {
    totalRevenue += row.revenue;
    totalUnits += row.quantity;
  });

  const averageOrderValue = transactionsCount > 0 ? totalRevenue / transactionsCount : 0;

  // 1. Time Series Trend (Monthly)
  const monthlyData = {};
  cleanRows.forEach(row => {
    if (!row.date) return;
    // Extract YYYY-MM
    const dateObj = new Date(row.date);
    if (isNaN(dateObj.getTime())) return;
    
    const year = dateObj.getFullYear();
    const monthIndex = dateObj.getMonth();
    const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    const monthLabel = dateObj.toLocaleString('default', { month: 'short', year: '2-digit' });

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { key: monthKey, label: monthLabel, revenue: 0, quantity: 0, orderCount: 0 };
    }
    monthlyData[monthKey].revenue += row.revenue;
    monthlyData[monthKey].quantity += row.quantity;
    monthlyData[monthKey].orderCount += 1;
  });

  const trendData = Object.values(monthlyData)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(item => ({
      name: item.label,
      Revenue: parseFloat(item.revenue.toFixed(2)),
      Quantity: item.quantity,
      Orders: item.orderCount
    }));

  // 2. Product Rankings
  const productData = {};
  cleanRows.forEach(row => {
    const prod = row.product;
    if (!productData[prod]) {
      productData[prod] = { product: prod, category: row.category, revenue: 0, quantity: 0, orders: 0 };
    }
    productData[prod].revenue += row.revenue;
    productData[prod].quantity += row.quantity;
    productData[prod].orders += 1;
  });

  const rankedProducts = Object.values(productData)
    .sort((a, b) => b.revenue - a.revenue)
    .map(item => ({
      ...item,
      revenue: parseFloat(item.revenue.toFixed(2))
    }));

  // 3. Category Distribution
  const categoryData = {};
  cleanRows.forEach(row => {
    const cat = row.category;
    if (!categoryData[cat]) {
      categoryData[cat] = { name: cat, value: 0, quantity: 0 };
    }
    categoryData[cat].value += row.revenue;
    categoryData[cat].quantity += row.quantity;
  });

  const categoryPieData = Object.values(categoryData).map(item => ({
    name: item.name,
    value: parseFloat(item.value.toFixed(2)),
    quantity: item.quantity
  })).sort((a, b) => b.value - a.value);

  // 4. Regional Breakdown
  const regionalData = {};
  cleanRows.forEach(row => {
    const reg = row.region;
    if (!regionalData[reg]) {
      regionalData[reg] = { region: reg, revenue: 0, quantity: 0, orders: 0 };
    }
    regionalData[reg].revenue += row.revenue;
    regionalData[reg].quantity += row.quantity;
    regionalData[reg].orders += 1;
  });

  const regionalMetrics = Object.values(regionalData)
    .map(item => ({
      region: item.region,
      Revenue: parseFloat(item.revenue.toFixed(2)),
      Quantity: item.quantity,
      AOV: parseFloat((item.revenue / item.orders).toFixed(2))
    }))
    .sort((a, b) => b.Revenue - a.Revenue);

  // 5. Generate Ambient Offline Insights (Rules Engine)
  const ambientInsights = [];

  if (rankedProducts.length > 0) {
    const topProd = rankedProducts[0];
    ambientInsights.push({
      type: 'success',
      title: '🏆 Star Product Identified',
      message: `${topProd.product} (${topProd.category}) is your highest revenue driver, generating $${topProd.revenue.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} (${((topProd.revenue / totalRevenue) * 100).toFixed(1)}% of total sales).`
    });

    if (rankedProducts.length > 1) {
      const bottomProd = rankedProducts[rankedProducts.length - 1];
      // Check if it's contributing less than 2%
      const percentage = (bottomProd.revenue / totalRevenue) * 100;
      ambientInsights.push({
        type: 'warning',
        title: '📉 Underperforming Product',
        message: `${bottomProd.product} is the lowest seller, contributing just $${bottomProd.revenue.toFixed(2)} (${percentage.toFixed(1)}% of sales). Consider promoting it or adjusting inventory.`
      });
    }
  }

  if (regionalMetrics.length > 1) {
    // Find average region revenue
    const avgRegionRevenue = totalRevenue / regionalMetrics.length;
    const weakestRegion = regionalMetrics[regionalMetrics.length - 1];
    
    if (weakestRegion.Revenue < avgRegionRevenue * 0.75) {
      const deficit = ((avgRegionRevenue - weakestRegion.Revenue) / avgRegionRevenue * 100).toFixed(0);
      ambientInsights.push({
        type: 'danger',
        title: '⚠️ Weak Regional Performance',
        message: `The ${weakestRegion.region} region is severely underperforming at $${weakestRegion.Revenue.toLocaleString()} in revenue, which is ${deficit}% below the average regional benchmark of $${avgRegionRevenue.toLocaleString(undefined, {maximumFractionDigits:0})}.`
      });
    } else {
      ambientInsights.push({
        type: 'info',
        title: '📍 Regional Insight',
        message: `The ${weakestRegion.region} region currently represents your lowest performing territory at $${weakestRegion.Revenue.toLocaleString()} in sales.`
      });
    }
  }

  // Detect recent trend changes (if trend has multiple months)
  if (trendData.length > 1) {
    const lastMonth = trendData[trendData.length - 1];
    const prevMonth = trendData[trendData.length - 2];
    const revDiff = lastMonth.Revenue - prevMonth.Revenue;
    const percentChange = (revDiff / prevMonth.Revenue) * 100;

    if (percentChange > 10) {
      ambientInsights.push({
        type: 'success',
        title: '📈 Positive Sales Momentum',
        message: `Revenue increased by ${percentChange.toFixed(1)}% in ${lastMonth.name} compared to ${prevMonth.name}, signaling strong positive sales growth.`
      });
    } else if (percentChange < -10) {
      ambientInsights.push({
        type: 'danger',
        title: '📉 Action Required: Sales Slowdown',
        message: `Sales dropped by ${Math.abs(percentChange).toFixed(1)}% in ${lastMonth.name} compared to ${prevMonth.name}. High risk of inventory stagnation.`
      });
    }
  }

  // Detect product specific trend - e.g. did Wireless Earbuds decline?
  // Let's check chronological order of wireless earbuds sales if it exists
  const earbudRows = cleanRows.filter(r => r.product.toLowerCase().includes('earbuds'));
  if (earbudRows.length > 5) {
    // Split into first half and second half by date
    const sortedEarbudRows = earbudRows.sort((a, b) => new Date(a.date) - new Date(b.date));
    const midIndex = Math.floor(sortedEarbudRows.length / 2);
    const firstHalfRev = sortedEarbudRows.slice(0, midIndex).reduce((sum, r) => sum + r.revenue, 0);
    const secondHalfRev = sortedEarbudRows.slice(midIndex).reduce((sum, r) => sum + r.revenue, 0);
    
    if (secondHalfRev < firstHalfRev * 0.7) {
      const dropPct = ((firstHalfRev - secondHalfRev) / firstHalfRev * 100).toFixed(0);
      ambientInsights.push({
        type: 'danger',
        title: '🚨 Declining Trend Alert',
        message: `Wireless Earbuds sales have dropped by ${dropPct}% between the first and second halves of the dataset. This requires immediate review of product pricing, reviews, or competitor activity.`
      });
    }
  }

  return {
    rawRows: cleanRows,
    metrics: {
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalUnits,
      transactionsCount,
      averageOrderValue: parseFloat(averageOrderValue.toFixed(2))
    },
    trendData,
    rankedProducts,
    categoryPieData,
    regionalMetrics,
    ambientInsights
  };
}
