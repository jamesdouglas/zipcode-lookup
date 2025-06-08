const Papa = require('papaparse');
const fs = require('fs').promises;
const path = require('path');

class CSVHandler {
    static async parseCSV(filePath, options = {}) {
        const {
            delimiter = ',',
            header = true,
            skipEmptyLines = true,
            transformHeader = true
        } = options;

        try {
            // Check if file exists
            const absolutePath = path.resolve(filePath);
            await fs.access(absolutePath);

            // Read file content
            const fileContent = await fs.readFile(absolutePath, 'utf8');

            // Parse CSV using papaparse
            const parseResult = Papa.parse(fileContent, {
                delimiter,
                header,
                skipEmptyLines,
                transformHeader: transformHeader ? (header) => header.toLowerCase().trim() : undefined,
                transform: (value, header) => {
                    // Basic data type conversion
                    if (value === '') return null;

                    // Try to convert numbers
                    if (!isNaN(value) && !isNaN(parseFloat(value))) {
                        return parseFloat(value);
                    }

                    // Trim whitespace from strings
                    return typeof value === 'string' ? value.trim() : value;
                }
            });

            if (parseResult.errors && parseResult.errors.length > 0) {
                console.warn('CSV parsing warnings:', parseResult.errors);
            }

            return parseResult.data;

        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Input file not found: ${filePath}`);
            }
            throw new Error(`Failed to parse CSV file: ${error.message}`);
        }
    }

    static async writeCSV(filePath, data, options = {}) {
        const {
            delimiter = ',',
            header = true,
            quotes = false,
            quoteChar = '"',
            escapeChar = '"'
        } = options;

        try {
            if (!data || data.length === 0) {
                throw new Error('No data to write to CSV');
            }

            // Convert data to CSV using papaparse
            const csv = Papa.unparse(data, {
                delimiter,
                header,
                quotes,
                quoteChar,
                escapeChar
            });

            // Ensure output directory exists
            const absolutePath = path.resolve(filePath);
            const outputDir = path.dirname(absolutePath);
            await fs.mkdir(outputDir, { recursive: true });

            // Write CSV file
            await fs.writeFile(absolutePath, csv, 'utf8');

            return absolutePath;

        } catch (error) {
            throw new Error(`Failed to write CSV file: ${error.message}`);
        }
    }

    static validateCSVStructure(data, requiredColumns = []) {
        if (!data || data.length === 0) {
            throw new Error('CSV data is empty');
        }

        const firstRow = data[0];
        const columns = Object.keys(firstRow);

        // Check for required columns
        const missingColumns = requiredColumns.filter(col => !columns.includes(col));
        if (missingColumns.length > 0) {
            throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
        }

        return {
            rowCount: data.length,
            columns: columns,
            sampleData: data.slice(0, 3) // Return first 3 rows as sample
        };
    }

    static async readCSVStream(filePath, processor, options = {}) {
        const {
            delimiter = ',',
            header = true,
            chunkSize = 1000
        } = options;

        try {
            const fileContent = await fs.readFile(path.resolve(filePath), 'utf8');

            return new Promise((resolve, reject) => {
                const results = [];
                let rowCount = 0;

                Papa.parse(fileContent, {
                    delimiter,
                    header,
                    skipEmptyLines: true,
                    step: async (row, parser) => {
                        try {
                            if (row.errors && row.errors.length > 0) {
                                console.warn(`Row ${rowCount + 1} parse errors:`, row.errors);
                            }

                            // Process the row
                            const processedRow = await processor(row.data, rowCount);
                            if (processedRow) {
                                results.push(processedRow);
                            }

                            rowCount++;

                            // Process in chunks to prevent memory issues
                            if (rowCount % chunkSize === 0) {
                                console.log(`Processed ${rowCount} rows...`);
                            }

                        } catch (error) {
                            console.error(`Error processing row ${rowCount + 1}:`, error.message);
                        }
                    },
                    complete: () => {
                        console.log(`Stream processing complete. ${rowCount} rows processed.`);
                        resolve(results);
                    },
                    error: (error) => {
                        reject(new Error(`CSV stream processing failed: ${error.message}`));
                    }
                });
            });

        } catch (error) {
            throw new Error(`Failed to process CSV stream: ${error.message}`);
        }
    }
}

// Export convenience functions
module.exports = {
    parseCSV: CSVHandler.parseCSV,
    writeCSV: CSVHandler.writeCSV,
    validateCSVStructure: CSVHandler.validateCSVStructure,
    readCSVStream: CSVHandler.readCSVStream,
    CSVHandler
};
