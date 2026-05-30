import React, { useState } from 'react';
import { parseCSV } from '../services/csvParser';
import { uploadSalesData } from '../services/aiInsightsService';

const FileUpload: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile && selectedFile.type === 'text/csv') {
            setFile(selectedFile);
            setError(null);
        } else {
            setFile(null);
            setError('Please upload a valid CSV file.');
        }
    };

    const handleUpload = async () => {
        if (file) {
            try {
                const data = await parseCSV(file);
                await uploadSalesData(data);
                alert('File uploaded and processed successfully.');
            } catch (err) {
                setError('Error processing the file. Please try again.');
            }
        }
    };

    return (
        <div>
            <input type="file" accept=".csv" onChange={handleFileChange} />
            <button onClick={handleUpload} disabled={!file}>
                Upload
            </button>
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
    );
};

export default FileUpload;