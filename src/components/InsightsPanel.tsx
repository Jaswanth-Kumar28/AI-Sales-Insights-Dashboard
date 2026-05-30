import React from 'react';

const InsightsPanel = ({ insights }) => {
    return (
        <div className="insights-panel">
            <h2>Sales Insights</h2>
            {insights.topProducts && (
                <div className="top-products">
                    <h3>Top Products</h3>
                    <ul>
                        {insights.topProducts.map((product, index) => (
                            <li key={index}>{product.name}: {product.sales}</li>
                        ))}
                    </ul>
                </div>
            )}
            {insights.decliningProducts && (
                <div className="declining-products">
                    <h3>Declining Products</h3>
                    <ul>
                        {insights.decliningProducts.map((product, index) => (
                            <li key={index}>{product.name}: {product.sales}</li>
                        ))}
                    </ul>
                </div>
            )}
            {insights.weakAreas && (
                <div className="weak-areas">
                    <h3>Weak Areas</h3>
                    <ul>
                        {insights.weakAreas.map((area, index) => (
                            <li key={index}>{area.name}: {area.performance}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default InsightsPanel;