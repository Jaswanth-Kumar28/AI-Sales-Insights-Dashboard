export type RawSalesRow = Record<string, string | number | null | undefined>;

export interface SalesRecord {
    product: string;
    area: string;
    category: string;
    revenue: number;
    units: number;
    date: Date | null;
}

export interface ProductInsight {
    name: string;
    revenue: number;
    units: number;
    share: number;
    firstPeriodRevenue: number;
    lastPeriodRevenue: number;
    changePercent: number;
}

export interface WeakAreaInsight {
    name: string;
    revenue: number;
    averageOrderValue: number;
    share: number;
    reason: string;
}

export interface SalesInsights {
    fileName: string;
    rowsAnalyzed: number;
    totalRevenue: number;
    totalUnits: number;
    averageOrderValue: number;
    topProducts: ProductInsight[];
    decliningProducts: ProductInsight[];
    weakAreas: WeakAreaInsight[];
    recommendations: string[];
    qualityNotes: string[];
}

const PRODUCT_KEYS = ['product', 'product name', 'item', 'sku', 'name'];
const AREA_KEYS = ['region', 'area', 'location', 'city', 'state', 'store', 'branch'];
const CATEGORY_KEYS = ['category', 'segment', 'department'];
const REVENUE_KEYS = ['revenue', 'sales', 'sale amount', 'amount', 'total', 'total sales', 'price'];
const UNITS_KEYS = ['quantity', 'qty', 'units', 'items sold', 'sold'];
const DATE_KEYS = ['date', 'order date', 'sale date', 'month'];

const normalizeKey = (key: string) => key.trim().toLowerCase().replace(/[_-]+/g, ' ');

const findValue = (row: RawSalesRow, candidates: string[]): string => {
    const keyMap = Object.keys(row).reduce<Record<string, string>>((acc, key) => {
        acc[normalizeKey(key)] = key;
        return acc;
    }, {});

    const matchingKey = candidates.find((candidate) => keyMap[candidate]);
    if (!matchingKey) {
        return '';
    }

    const value = row[keyMap[matchingKey]];
    return value === null || value === undefined ? '' : String(value).trim();
};

const toNumber = (value: string): number => {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
};

const parseDate = (value: string): Date | null => {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const currency = (value: number) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    }).format(value);

const percent = (value: number) => `${value.toFixed(1)}%`;

const buildProductMetrics = (records: SalesRecord[], totalRevenue: number): ProductInsight[] => {
    const sortedDates = records.reduce<number[]>((dates, record) => {
        if (record.date) {
            dates.push(record.date.getTime());
        }

        return dates;
    }, []);
    sortedDates.sort((a, b) => a - b);
    const midpoint = sortedDates.length > 1 ? sortedDates[Math.floor(sortedDates.length / 2)] : null;

    const byProduct = records.reduce<Record<string, ProductInsight>>((acc, record) => {
        if (!acc[record.product]) {
            acc[record.product] = {
                name: record.product,
                revenue: 0,
                units: 0,
                share: 0,
                firstPeriodRevenue: 0,
                lastPeriodRevenue: 0,
                changePercent: 0
            };
        }

        const product = acc[record.product];
        product.revenue += record.revenue;
        product.units += record.units;

        if (midpoint && record.date && record.date.getTime() < midpoint) {
            product.firstPeriodRevenue += record.revenue;
        } else {
            product.lastPeriodRevenue += record.revenue;
        }

        return acc;
    }, {});

    return Object.values(byProduct)
        .map((product) => ({
            ...product,
            share: totalRevenue ? (product.revenue / totalRevenue) * 100 : 0,
            changePercent: product.firstPeriodRevenue
                ? ((product.lastPeriodRevenue - product.firstPeriodRevenue) / product.firstPeriodRevenue) * 100
                : product.lastPeriodRevenue > 0
                    ? 100
                    : 0
        }))
        .sort((a, b) => b.revenue - a.revenue);
};

const buildWeakAreas = (records: SalesRecord[], totalRevenue: number): WeakAreaInsight[] => {
    const byArea = records.reduce<Record<string, { revenue: number; units: number; rows: number }>>((acc, record) => {
        if (!acc[record.area]) {
            acc[record.area] = { revenue: 0, units: 0, rows: 0 };
        }

        acc[record.area].revenue += record.revenue;
        acc[record.area].units += record.units;
        acc[record.area].rows += 1;
        return acc;
    }, {});

    const areas = Object.entries(byArea)
        .map(([name, area]) => {
            const share = totalRevenue ? (area.revenue / totalRevenue) * 100 : 0;
            return {
                name,
                revenue: area.revenue,
                averageOrderValue: area.rows ? area.revenue / area.rows : 0,
                share,
                reason: `${name} contributes ${percent(share)} of revenue with ${area.units} units sold.`
            };
        })
        .sort((a, b) => a.revenue - b.revenue);

    return areas.slice(0, 4);
};

const normalizeRows = (rows: RawSalesRow[]): { records: SalesRecord[]; qualityNotes: string[] } => {
    let missingRevenueRows = 0;
    let missingProductRows = 0;
    const records = rows.map((row, index) => {
        const revenueValue = findValue(row, REVENUE_KEYS);
        const product = findValue(row, PRODUCT_KEYS) || `Product ${index + 1}`;
        const revenue = toNumber(revenueValue);
        const units = toNumber(findValue(row, UNITS_KEYS)) || 1;

        if (!revenueValue || revenue <= 0) {
            missingRevenueRows += 1;
        }

        if (!findValue(row, PRODUCT_KEYS)) {
            missingProductRows += 1;
        }

        return {
            product,
            area: findValue(row, AREA_KEYS) || 'Unassigned area',
            category: findValue(row, CATEGORY_KEYS) || 'General',
            revenue,
            units,
            date: parseDate(findValue(row, DATE_KEYS))
        };
    }).filter((record) => record.revenue > 0);

    const qualityNotes = [];
    if (missingRevenueRows > 0) {
        qualityNotes.push(`${missingRevenueRows} row(s) had missing or zero revenue and were excluded.`);
    }
    if (missingProductRows > 0) {
        qualityNotes.push(`${missingProductRows} row(s) were missing product names, so fallback labels were used.`);
    }
    if (!records.some((record) => record.date)) {
        qualityNotes.push('No usable date column was found, so decline detection uses available row totals only.');
    }

    return { records, qualityNotes };
};

const buildRecommendations = (
    topProducts: ProductInsight[],
    decliningProducts: ProductInsight[],
    weakAreas: WeakAreaInsight[]
): string[] => {
    const recommendations = [];

    if (topProducts[0]) {
        recommendations.push(`Double down on ${topProducts[0].name}; it leads revenue at ${currency(topProducts[0].revenue)}.`);
    }

    if (decliningProducts[0]) {
        recommendations.push(`Investigate ${decliningProducts[0].name}; revenue is down ${percent(Math.abs(decliningProducts[0].changePercent))}.`);
    }

    if (weakAreas[0]) {
        recommendations.push(`Review pricing, stock, or promotion in ${weakAreas[0].name}; it is the weakest area by revenue.`);
    }

    if (recommendations.length < 3) {
        recommendations.push('Upload date-wise sales data to unlock stronger trend and decline insights.');
    }

    return recommendations;
};

export const analyzeSalesData = (rows: RawSalesRow[], fileName = 'Uploaded CSV'): SalesInsights => {
    const { records, qualityNotes } = normalizeRows(rows);
    const totalRevenue = records.reduce((sum, record) => sum + record.revenue, 0);
    const totalUnits = records.reduce((sum, record) => sum + record.units, 0);
    const topProducts = buildProductMetrics(records, totalRevenue);
    const decliningProducts = topProducts
        .filter((product) => product.firstPeriodRevenue > 0 && product.changePercent < 0)
        .sort((a, b) => a.changePercent - b.changePercent)
        .slice(0, 5);
    const weakAreas = buildWeakAreas(records, totalRevenue);

    return {
        fileName,
        rowsAnalyzed: records.length,
        totalRevenue,
        totalUnits,
        averageOrderValue: records.length ? totalRevenue / records.length : 0,
        topProducts: topProducts.slice(0, 5),
        decliningProducts,
        weakAreas,
        recommendations: buildRecommendations(topProducts, decliningProducts, weakAreas),
        qualityNotes
    };
};

export const formatCurrency = currency;
export const formatPercent = percent;
