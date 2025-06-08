const { formatOutput } = require('../utils/formatters');
const { parseCSV, writeCSV } = require('../utils/csv-handler');
const { calculateDistance } = require('../utils/distance');
const RadiusSearchCommand = require('./radius');
const LocationSearchCommand = require('./location');
const CensusSearchCommand = require('./census');
const zipcodes = require('zipcodes');

class BatchProcessingCommand {
    constructor() {
        this.radiusCommand = new RadiusSearchCommand();
        this.locationCommand = new LocationSearchCommand();
        this.censusCommand = new CensusSearchCommand();
    }

    async execute(options) {
        const {
            input,
            output,
            operation,
            radius,
            centroidZipcode,
            source = 'auto',
            includeDistance,
            progressBar = true,
            delimiter = ',',
            skipErrors = true,
            batchSize = 100
        } = options;

        if (!input) {
            throw new Error('--input file is required for batch processing');
        }

        if (!output) {
            throw new Error('--output file is required for batch processing');
        }

        if (!operation) {
            throw new Error('--operation must be specified (radius, location, census, or distance)');
        }

        // Validate distance operation requirements
        if (operation === 'distance' && !centroidZipcode) {
            throw new Error('--centroid-zipcode is required for distance operations');
        }

        try {
            // Parse input CSV
            const inputData = await parseCSV(input, { delimiter });

            if (!inputData || inputData.length === 0) {
                throw new Error('Input file is empty or could not be parsed');
            }

            // Validate required columns based on operation
            this.validateInputColumns(inputData[0], operation);

            // Process data in batches
            const results = await this.processBatches(
                inputData,
                operation,
                { radius, centroidZipcode, source, includeDistance, skipErrors, batchSize, progressBar }
            );

            // Write output CSV
            await writeCSV(output, results, { delimiter });

            return `Batch processing complete. Processed ${inputData.length} records, output written to ${output}`;

        } catch (error) {
            throw new Error(`Batch processing failed: ${error.message}`);
        }
    }

    validateInputColumns(firstRow, operation) {
        const columns = Object.keys(firstRow);

        switch (operation) {
            case 'radius':
                if (!columns.includes('zipcode')) {
                    throw new Error('Input CSV must contain a "zipcode" column for radius operations');
                }
                break;

            case 'location':
                if (!columns.includes('state') || (!columns.includes('city') && !columns.includes('county'))) {
                    throw new Error('Input CSV must contain "state" and either "city" or "county" columns for location operations');
                }
                break;

            case 'census':
                if (!columns.includes('zipcode')) {
                    throw new Error('Input CSV must contain a "zipcode" column for census operations');
                }
                break;

            case 'distance':
                if (!columns.includes('zipcode')) {
                    throw new Error('Input CSV must contain a "zipcode" column for distance operations');
                }
                break;

            default:
                throw new Error(`Unsupported operation: ${operation}`);
        }
    }

    async processBatches(inputData, operation, options) {
        const { batchSize, progressBar, skipErrors } = options;
        const results = [];
        const totalBatches = Math.ceil(inputData.length / batchSize);

        if (progressBar) {
            console.log(`Processing ${inputData.length} records in ${totalBatches} batches...`);
        }

        for (let i = 0; i < inputData.length; i += batchSize) {
            const batch = inputData.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;

            if (progressBar) {
                console.log(`Processing batch ${batchNumber}/${totalBatches}...`);
            }

            const batchResults = await this.processBatch(batch, operation, options, skipErrors);
            results.push(...batchResults);

            // Small delay to prevent overwhelming APIs
            await this.delay(100);
        }

        if (progressBar) {
            console.log(`Batch processing complete. ${results.length} total results.`);
        }

        return results;
    }

    async processBatch(batch, operation, options, skipErrors) {
        const promises = batch.map(async (row, index) => {
            try {
                return await this.processRow(row, operation, options, index);
            } catch (error) {
                if (skipErrors) {
                    console.warn(`Row ${index + 1} failed: ${error.message}`);
                    return {
                        ...row,
                        error: error.message,
                        success: false
                    };
                } else {
                    throw error;
                }
            }
        });

        const results = await Promise.all(promises);

        // Flatten results since radius operations can return multiple rows per input
        const flattenedResults = [];
        for (const result of results) {
            if (Array.isArray(result)) {
                flattenedResults.push(...result);
            } else {
                flattenedResults.push(result);
            }
        }

        return flattenedResults;
    }

    async processRow(row, operation, options) {
        const { radius, centroidZipcode, source, includeDistance } = options;

        switch (operation) {
            case 'radius':
                return await this.processRadiusRow(row, { radius, source, includeDistance });

            case 'location':
                return await this.processLocationRow(row, { source });

            case 'census':
                return await this.processCensusRow(row, { source });

            case 'distance':
                return await this.processDistanceRow(row, { centroidZipcode, source });

            default:
                throw new Error(`Unsupported operation: ${operation}`);
        }
    }

    async processRadiusRow(row, options) {
        const { radius, source, includeDistance } = options;

        if (!radius) {
            throw new Error('Radius must be specified for radius operations');
        }

        const searchOptions = {
            zipcode: row.zipcode,
            miles: radius,
            source,
            includeDistance,
            output: 'raw' // Get raw data for CSV processing
        };

        const results = await this.radiusCommand.execute(searchOptions);

        // Return all results, not just a summary - each zipcode gets its own row
        if (results && results.length > 0) {
            return results.map(result => ({
                input_zipcode: row.zipcode,
                zipcode: result.zipcode,
                city: result.city,
                state: result.state,
                latitude: result.latitude,
                longitude: result.longitude,
                distance_miles: includeDistance ? result.distance_miles : null,
                success: true
            }));
        } else {
            // If no results found, return one row indicating this
            return [{
                input_zipcode: row.zipcode,
                zipcode: null,
                city: null,
                state: null,
                latitude: null,
                longitude: null,
                distance_miles: null,
                success: false,
                error: 'No zipcodes found within radius'
            }];
        }
    }

    async processLocationRow(row, options) {
        const { source } = options;

        const searchOptions = {
            city: row.city || null,
            county: row.county || null,
            state: row.state,
            source,
            output: 'raw'
        };

        const results = await this.locationCommand.execute(searchOptions);

        return {
            input_city: row.city || '',
            input_county: row.county || '',
            input_state: row.state,
            results_count: results.length,
            primary_zipcode: results.length > 0 ? results[0].zipcode : null,
            success: true
        };
    }

    async processCensusRow(row, options) {
        const { source } = options;

        const searchOptions = {
            zipcode: row.zipcode,
            source,
            output: 'raw'
        };

        const results = await this.censusCommand.execute(searchOptions);

        return {
            input_zipcode: row.zipcode,
            census_tract: results.length > 0 ? results[0].census_tract : null,
            fips_state: results.length > 0 ? results[0].fips_state : null,
            fips_county: results.length > 0 ? results[0].fips_county : null,
            fips_tract: results.length > 0 ? results[0].fips_tract : null,
            success: true
        };
    }

    async processDistanceRow(row, options) {
        const { centroidZipcode, source } = options;

        try {
            // Get centroid zipcode coordinates
            const centroidData = zipcodes.lookup(centroidZipcode);
            if (!centroidData) {
                throw new Error(`Could not find coordinates for centroid zipcode ${centroidZipcode}`);
            }

            // Get target zipcode coordinates
            const targetData = zipcodes.lookup(row.zipcode);
            if (!targetData) {
                return {
                    centroid: centroidZipcode,
                    zipcode: row.zipcode,
                    city: null,
                    state: null,
                    latitude: null,
                    longitude: null,
                    distance_miles: null,
                    success: false,
                    error: `Could not find coordinates for zipcode ${row.zipcode}`
                };
            }

            // Calculate distance between centroid and target zipcode
            const distance = calculateDistance(
                centroidData.latitude,
                centroidData.longitude,
                targetData.latitude,
                targetData.longitude
            );

            return {
                centroid: centroidZipcode,
                zipcode: targetData.zip,
                city: targetData.city,
                state: targetData.state,
                latitude: targetData.latitude,
                longitude: targetData.longitude,
                distance_miles: parseFloat(distance.toFixed(2)),
                success: true
            };

        } catch (error) {
            return {
                centroid: centroidZipcode,
                zipcode: row.zipcode,
                city: null,
                state: null,
                latitude: null,
                longitude: null,
                distance_miles: null,
                success: false,
                error: error.message
            };
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // No cleanup needed - using in-memory zipcodes package
}

module.exports = BatchProcessingCommand;
