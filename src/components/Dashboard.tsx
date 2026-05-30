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
                    <SummaryCard title="Top Products" value="-" description="Upload sales data to identify leaders." />
                    <SummaryCard title="Declining Products" value="-" description="Upload dated sales data to find drops." />
                    <SummaryCard title="Weak Areas" value="-" description="Upload sales data to locate weaker regions." />
                </div>
            </div>
        );
    }
}

export default Dashboard;
