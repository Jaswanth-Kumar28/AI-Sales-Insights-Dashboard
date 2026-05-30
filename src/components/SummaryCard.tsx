import React from 'react';

interface SummaryCardProps {
    title: string;
    value: string | number;
    description: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, description }) => {
    return (
        <div className="summary-card">
            <h3>{title}</h3>
            <p>{value}</p>
            <small>{description}</small>
        </div>
    );
};

export default SummaryCard;