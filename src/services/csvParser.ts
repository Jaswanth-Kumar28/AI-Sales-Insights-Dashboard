import { parse } from 'papaparse';

export const parseCSV = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        parse(file, {
            complete: (results) => {
                resolve(results.data);
            },
            header: true,
            skipEmptyLines: true,
            error: (error) => {
                reject(error);
            }
        });
    });
};