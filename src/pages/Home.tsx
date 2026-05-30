import React from 'react';
import Dashboard from '../components/Dashboard';
import FileUpload from '../components/FileUpload';

const Home: React.FC = () => {
    return (
        <div>
            <h1>Sales Insights Dashboard</h1>
            <FileUpload />
            <Dashboard />
        </div>
    );
};

export default Home;