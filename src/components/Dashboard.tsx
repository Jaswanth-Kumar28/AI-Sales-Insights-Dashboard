import React from 'react';
import InsightsPanel from './InsightsPanel';
import SummaryCard from './SummaryCard';

class Dashboard extends React.Component {
    render() {
        return (
            <div className="dashboard">
                <h1>Sales Insights Dashboard</h1>
                <InsightsPanel />
                <div className="summary-cards">
                    <SummaryCard title="Top Products" />
                    <SummaryCard title="Declining Products" />
                    <SummaryCard title="Weak Areas" />
                </div>
            </div>
        );
    }
}

export default Dashboard;