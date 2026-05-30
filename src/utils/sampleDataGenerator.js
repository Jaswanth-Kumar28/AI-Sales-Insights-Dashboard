/**
 * Generates a highly realistic sales CSV string for the last 6 months.
 * Designed with specific trends and business insights:
 * - Total ~120 records
 * - Product Categories: Electronics, Office Supplies, Apparel, Home Goods
 * - Regions: North, South, East, West
 * - "Smart Watch" is a best-seller with rising demand.
 * - "Wireless Earbuds" has a declining trend due to quality complaints.
 * - "South" is a weak region due to understaffing.
 * - Seasonal spike in December (holidays) and May (spring promotions).
 */
export function generateSampleCSV() {
  const categories = {
    "Electronics": ["Smart Watch", "Wireless Earbuds", "Bluetooth Speaker"],
    "Office Supplies": ["Ergonomic Keyboard", "Desk Organizer", "LED Desk Lamp"],
    "Apparel": ["Running Shoes", "Leather Wallet", "Athletic Hoodie"],
    "Home Goods": ["Insulated Water Bottle", "Ceramic Coffee Mug", "Aroma Diffuser"]
  };

  const prices = {
    "Smart Watch": 199.99,
    "Wireless Earbuds": 89.99,
    "Bluetooth Speaker": 59.99,
    "Ergonomic Keyboard": 79.99,
    "Desk Organizer": 29.99,
    "LED Desk Lamp": 39.99,
    "Running Shoes": 120.00,
    "Leather Wallet": 45.00,
    "Athletic Hoodie": 55.00,
    "Insulated Water Bottle": 25.00,
    "Ceramic Coffee Mug": 15.00,
    "Aroma Diffuser": 35.00
  };

  const regions = ["North", "South", "East", "West"];
  const csvRows = ["Date,Order ID,Product,Category,Quantity,Unit Price,Revenue,Region"];

  const now = new Date();
  let orderCounter = 10001;

  // Generate records for the last 180 days
  for (let i = 180; i >= 0; i--) {
    const currentDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = currentDate.toISOString().split('T')[0];
    const month = currentDate.getMonth(); // 0-11
    
    // Determine number of transactions for the day based on seasonal trends
    // High in December (month 11), medium-high in May (month 4), lower in January (month 0)
    let numTransactions;
    const rand = Math.random();
    
    if (month === 11) { // December peak
      numTransactions = rand > 0.3 ? (rand > 0.7 ? 3 : 2) : 1;
    } else if (month === 4) { // May spring promo
      numTransactions = rand > 0.4 ? 2 : 1;
    } else if (month === 0) { // January dip
      numTransactions = rand > 0.8 ? 1 : 0;
    } else {
      numTransactions = rand > 0.5 ? (rand > 0.9 ? 2 : 1) : 0;
    }

    for (let t = 0; t < numTransactions; t++) {
      orderCounter++;
      const orderId = `SLS-${orderCounter}`;
      
      // Select random category
      const categoryKeys = Object.keys(categories);
      const category = categoryKeys[Math.floor(Math.random() * categoryKeys.length)];
      
      // Select random product in category
      const products = categories[category];
      let product = products[Math.floor(Math.random() * products.length)];
      
      // Apply trends to product selections
      // If we are in recent months (e.g. last 60 days), push Smart Watches more and make Earbuds less frequent
      if (i < 60) {
        if (category === "Electronics") {
          const innerRand = Math.random();
          product = innerRand < 0.6 ? "Smart Watch" : (innerRand < 0.9 ? "Bluetooth Speaker" : "Wireless Earbuds");
        }
      }

      // Choose region
      let region = regions[Math.floor(Math.random() * regions.length)];
      // Introduce regional weakness: Make South region transactions rarer and smaller quantity
      if (region === "South" && Math.random() > 0.4) {
        // Reroll region to create a deficit in South
        region = regions[Math.floor(Math.random() * regions.length)];
      }

      // Quantity rules
      let quantity = 1;
      if (product === "Ceramic Coffee Mug" || product === "Insulated Water Bottle") {
        quantity = Math.floor(Math.random() * 3) + 1; // 1-3
      } else if (product === "Desk Organizer" && Math.random() > 0.7) {
        quantity = 2;
      } else if (region === "South") {
        quantity = 1; // South orders are always small
      } else if (Math.random() > 0.85) {
        quantity = 2;
      }

      const unitPrice = prices[product];
      // Introduce an intentional discount/pricing error or just calculate exact revenue
      const revenue = (unitPrice * quantity).toFixed(2);

      csvRows.push(`${dateStr},${orderId},"${product}","${category}",${quantity},${unitPrice},${revenue},"${region}"`);
    }
  }

  return csvRows.join("\n");
}
