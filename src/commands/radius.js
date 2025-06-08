const { formatOutput, filterFields } = require('../utils/formatters');
const { calculateDistance } = require('../utils/distance');
const APIClient = require('../data/sources/api-client');
const zipcodes = require('zipcodes');

class RadiusSearchCommand {
    constructor() {
        this.apiClient = new APIClient();
    }

    async execute(options) {
        const { zipcode, miles, kilometers, source = 'auto', compare, includeDistance, fields, output = 'table' } = options;

        // Convert distance to common unit (miles)
        const radiusMiles = kilometers ? kilometers * 0.621371 : miles;

        if (!radiusMiles) {
            throw new Error('Distance must be specified in either --miles or --kilometers');
        }

        try {
            // If compare option is provided, perform comparison analysis
            if (compare) {
                return await this.executeComparison(zipcode, source, compare, radiusMiles, options);
            }

            // Get the center point coordinates
            const centerPoint = await this.getCenterPoint(zipcode, source);
            if (!centerPoint) {
                throw new Error(`Could not find coordinates for zipcode ${zipcode}`);
            }

            // Find zipcodes within radius
            const results = await this.findZipcodesInRadius(centerPoint, radiusMiles, source);

            // Filter and enhance results
            let processedResults = this.processResults(results, centerPoint, radiusMiles, includeDistance);

            // Apply field filtering if specified
            if (fields) {
                processedResults = filterFields(processedResults, { fields });
            }

            // Format and return output
            return formatOutput(processedResults, output);

        } catch (error) {
            throw new Error(`Radius search failed: ${error.message}`);
        }
    }

    async executeComparison(zipcode, source, compareSource, radiusMiles, options) {
        const { includeDistance, output = 'table' } = options;

        try {
            // Get coordinates from both sources
            const primaryPoint = await this.getCenterPoint(zipcode, source);
            const comparePoint = await this.getCenterPoint(zipcode, compareSource);

            if (!primaryPoint) {
                throw new Error(`Could not find coordinates for zipcode ${zipcode} using source: ${source}`);
            }

            if (!comparePoint) {
                throw new Error(`Could not find coordinates for zipcode ${zipcode} using comparison source: ${compareSource}`);
            }

            // Calculate distance between the two coordinate sets
            const coordinateDifference = calculateDistance(
                primaryPoint.latitude,
                primaryPoint.longitude,
                comparePoint.latitude,
                comparePoint.longitude
            );

            // Get radius results from both sources
            const primaryResults = await this.findZipcodesInRadius(primaryPoint, radiusMiles, source);
            const compareResults = await this.findZipcodesInRadius(comparePoint, radiusMiles, compareSource);

            // Process both result sets
            const primaryProcessed = this.processResults(primaryResults, primaryPoint, radiusMiles, true);
            const compareProcessed = this.processResults(compareResults, comparePoint, radiusMiles, true);

            // Build comparison output
            const comparisonData = {
                zipcode: zipcode,
                radius_miles: radiusMiles,
                source_comparison: {
                    primary_source: source,
                    compare_source: compareSource,
                    coordinate_difference_miles: parseFloat(coordinateDifference.toFixed(4))
                },
                coordinates: {
                    primary: {
                        source: source,
                        latitude: primaryPoint.latitude,
                        longitude: primaryPoint.longitude,
                        city: primaryPoint.city,
                        state: primaryPoint.state
                    },
                    compare: {
                        source: compareSource,
                        latitude: comparePoint.latitude,
                        longitude: comparePoint.longitude,
                        city: comparePoint.city,
                        state: comparePoint.state
                    }
                },
                results_summary: {
                    primary_count: primaryProcessed.length,
                    compare_count: compareProcessed.length,
                    difference: primaryProcessed.length - compareProcessed.length
                }
            };

            // If distance is requested, include detailed comparison
            if (includeDistance) {
                comparisonData.detailed_comparison = this.buildDetailedComparison(
                    primaryProcessed,
                    compareProcessed,
                    source,
                    compareSource
                );
            }

            // Handle table format specially for comparison data
            if (output === 'table') {
                return this.formatComparisonTable(comparisonData);
            }

            return formatOutput(comparisonData, output);

        } catch (error) {
            throw new Error(`Comparison failed: ${error.message}`);
        }
    }

    buildDetailedComparison(primaryResults, compareResults, primarySource, compareSource) {
        // Validate inputs
        if (!Array.isArray(primaryResults)) {
            primaryResults = [];
        }
        if (!Array.isArray(compareResults)) {
            compareResults = [];
        }

        // Validate each item in arrays has required properties
        const validPrimary = primaryResults.filter(r => r && r.zipcode);
        const validCompare = compareResults.filter(r => r && r.zipcode);

        // Create a map of zipcodes for easier comparison
        try {
            const primaryMap = new Map(validPrimary.map(r => [r.zipcode, r]));
            const compareMap = new Map(validCompare.map(r => [r.zipcode, r]));

            // Get all unique zipcodes from both sources
            const allZipcodes = new Set([...primaryMap.keys(), ...compareMap.keys()]);

            const comparison = [];
            for (const zipcode of allZipcodes) {
                const primaryResult = primaryMap.get(zipcode);
                const compareResult = compareMap.get(zipcode);

                const comparisonEntry = {
                    zipcode: zipcode,
                    in_primary: !!primaryResult,
                    in_compare: !!compareResult
                };

                if (primaryResult) {
                    comparisonEntry.primary_distance = primaryResult.distance_miles;
                    comparisonEntry.primary_coordinates = {
                        latitude: primaryResult.latitude,
                        longitude: primaryResult.longitude
                    };
                }

                if (compareResult) {
                    comparisonEntry.compare_distance = compareResult.distance_miles;
                    comparisonEntry.compare_coordinates = {
                        latitude: compareResult.latitude,
                        longitude: compareResult.longitude
                    };
                }

                // Calculate distance difference if both sources have the zipcode
                if (primaryResult && compareResult) {
                    comparisonEntry.distance_difference = parseFloat(
                        (primaryResult.distance_miles - compareResult.distance_miles).toFixed(4)
                    );

                    // Calculate coordinate difference between sources for this zipcode
                    comparisonEntry.coordinate_difference_miles = parseFloat(
                        calculateDistance(
                            primaryResult.latitude,
                            primaryResult.longitude,
                            compareResult.latitude,
                            compareResult.longitude
                        ).toFixed(4)
                    );
                }

                comparison.push(comparisonEntry);
            }

            // Sort by zipcode
            return comparison.sort((a, b) => a.zipcode.localeCompare(b.zipcode));
        } catch (error) {
            console.error(`Error in buildDetailedComparison: ${error.message}`);
            return [];
        }
    }

    async getCenterPoint(zipcode, source) {
        // Handle specific source requests
        if (source === 'nominatim') {
            const result = await this.apiClient.getNominatimZipcode(zipcode);
            if (result && result.latitude && result.longitude) {
                return {
                    zipcode,
                    latitude: result.latitude,
                    longitude: result.longitude,
                    city: result.city,
                    state: result.state
                };
            }
            throw new Error(`Nominatim API could not find zipcode ${zipcode}`);
        }

        if (source === 'zippopotam') {
            const result = await this.apiClient.getZippopotamZipcode(zipcode);
            if (result && result.latitude && result.longitude) {
                return {
                    zipcode,
                    latitude: result.latitude,
                    longitude: result.longitude,
                    city: result.city,
                    state: result.state
                };
            }
            throw new Error(`Zippopotam API could not find zipcode ${zipcode}`);
        }

        // Default to zipcodes package (for 'zipcodes' source or 'auto' mode)
        try {
            const zipData = zipcodes.lookup(zipcode);
            if (zipData && zipData.latitude && zipData.longitude) {
                return {
                    zipcode,
                    latitude: zipData.latitude,
                    longitude: zipData.longitude,
                    city: zipData.city,
                    state: zipData.state
                };
            }
        } catch (error) {
            console.warn(`Zipcodes package lookup failed: ${error.message}`);
        }

        // If zipcodes package fails and we're in auto mode, try external APIs
        if (source === 'auto') {
            const result = await this.apiClient.getZipcode(zipcode);
            if (result && result.latitude && result.longitude) {
                console.log(`✅ Found ${zipcode} via external API fallback`);
                return {
                    zipcode,
                    latitude: result.latitude,
                    longitude: result.longitude,
                    city: result.city,
                    state: result.state
                };
            }
        }

        return null;
    }

    async findZipcodesInRadius(centerPoint, radiusMiles, source) {
        // Handle API-specific sources
        if (source === 'nominatim' || source === 'zippopotam') {
            // APIs don't support radius search, so fall back to zipcodes package
            return await this.zipcodesRadiusSearch(centerPoint, radiusMiles);
        }

        // Use zipcodes package for radius search (default and most efficient)
        return await this.zipcodesRadiusSearch(centerPoint, radiusMiles);
    }

    async zipcodesRadiusSearch(centerPoint, radiusMiles) {
        try {
            const nearbyZipArray = zipcodes.radius(centerPoint.zipcode, radiusMiles);
            const nearbyZipcodes = [];

            for (const zipcode of nearbyZipArray) {
                const zipData = zipcodes.lookup(zipcode);
                if (zipData) {
                    nearbyZipcodes.push({
                        zipcode: zipData.zip,
                        latitude: zipData.latitude,
                        longitude: zipData.longitude,
                        city: zipData.city,
                        state: zipData.state
                    });
                }
            }

            return nearbyZipcodes;
        } catch (error) {
            console.warn(`Zipcodes package radius search failed: ${error.message}`);
            return [];
        }
    }

    processResults(results, centerPoint, radiusMiles, includeDistance) {
        // Validate inputs
        if (!Array.isArray(results)) {
            console.warn(`Results is not an array: ${typeof results}`);
            return [];
        }

        return results
            .map(zipData => {
                const distance = calculateDistance(
                    centerPoint.latitude,
                    centerPoint.longitude,
                    zipData.latitude,
                    zipData.longitude
                );

                // Only include zipcodes within the specified radius
                if (distance > radiusMiles) {
                    return null;
                }

                const result = {
                    zipcode: zipData.zipcode,
                    city: zipData.city,
                    state: zipData.state,
                    latitude: zipData.latitude,
                    longitude: zipData.longitude
                };

                if (includeDistance) {
                    result.distance_miles = parseFloat(distance.toFixed(2));
                }

                return result;
            })
            .filter(result => result !== null)
            .sort((a, b) => {
                if (includeDistance) {
                    return a.distance_miles - b.distance_miles;
                }
                return a.zipcode.localeCompare(b.zipcode);
            });
    }

    formatComparisonTable(comparisonData) {
        const chalk = require('chalk');
        const Table = require('cli-table3');

        let output = '';

        // Summary header
        output += chalk.blue.bold(`\nZipcode Comparison: ${comparisonData.zipcode}\n`);
        output += chalk.yellow(`Radius: ${comparisonData.radius_miles} miles\n`);
        output += chalk.cyan(`Primary Source: ${comparisonData.source_comparison.primary_source}\n`);
        output += chalk.cyan(`Compare Source: ${comparisonData.source_comparison.compare_source}\n`);
        output += chalk.magenta(`Coordinate Difference: ${comparisonData.source_comparison.coordinate_difference_miles} miles\n\n`);

        // Coordinates comparison table
        const coordTable = new Table({
            head: ['Source', 'Latitude', 'Longitude', 'City', 'State'].map(h => chalk.cyan(h)),
            style: { head: [], border: [] }
        });

        coordTable.push([
            chalk.yellow(comparisonData.coordinates.primary.source),
            chalk.green(comparisonData.coordinates.primary.latitude.toString()),
            chalk.green(comparisonData.coordinates.primary.longitude.toString()),
            comparisonData.coordinates.primary.city,
            comparisonData.coordinates.primary.state
        ]);

        coordTable.push([
            chalk.yellow(comparisonData.coordinates.compare.source),
            chalk.green(comparisonData.coordinates.compare.latitude.toString()),
            chalk.green(comparisonData.coordinates.compare.longitude.toString()),
            comparisonData.coordinates.compare.city,
            comparisonData.coordinates.compare.state
        ]);

        output += chalk.bold('Center Point Coordinates:\n');
        output += coordTable.toString() + '\n\n';

        // Results summary
        output += chalk.bold('Results Summary:\n');
        output += `${comparisonData.source_comparison.primary_source}: ${chalk.green(comparisonData.results_summary.primary_count)} zipcodes\n`;
        output += `${comparisonData.source_comparison.compare_source}: ${chalk.green(comparisonData.results_summary.compare_count)} zipcodes\n`;
        output += `Difference: ${chalk.yellow(comparisonData.results_summary.difference)} zipcodes\n\n`;

        // Detailed comparison if available
        if (comparisonData.detailed_comparison && comparisonData.detailed_comparison.length > 0) {
            output += chalk.bold('Detailed Zipcode Comparison:\n');

            const detailTable = new Table({
                head: [
                    'Zipcode',
                    `${comparisonData.source_comparison.primary_source} Dist`,
                    `${comparisonData.source_comparison.primary_source} Lat`,
                    `${comparisonData.source_comparison.primary_source} Lon`,
                    `${comparisonData.source_comparison.compare_source} Dist`,
                    `${comparisonData.source_comparison.compare_source} Lat`,
                    `${comparisonData.source_comparison.compare_source} Lon`,
                    'Diff',
                    'In Primary',
                    'In Compare'
                ].map(h => chalk.cyan(h)),
                style: { head: [], border: [] }
            });

            comparisonData.detailed_comparison.forEach(item => {
                const primaryDist = item.primary_distance !== undefined ?
                    chalk.green(item.primary_distance.toString()) : chalk.gray('N/A');
                const primaryLat = item.primary_coordinates ?
                    chalk.green(item.primary_coordinates.latitude.toString()) : chalk.gray('N/A');
                const primaryLon = item.primary_coordinates ?
                    chalk.green(item.primary_coordinates.longitude.toString()) : chalk.gray('N/A');

                const compareDist = item.compare_distance !== undefined ?
                    chalk.green(item.compare_distance.toString()) : chalk.gray('N/A');
                const compareLat = item.compare_coordinates ?
                    chalk.green(item.compare_coordinates.latitude.toString()) : chalk.gray('N/A');
                const compareLon = item.compare_coordinates ?
                    chalk.green(item.compare_coordinates.longitude.toString()) : chalk.gray('N/A');

                const diff = item.distance_difference !== undefined ?
                    (item.distance_difference > 0 ? chalk.red(`+${item.distance_difference}`) :
                     item.distance_difference < 0 ? chalk.blue(item.distance_difference.toString()) :
                     chalk.green('0')) : chalk.gray('N/A');

                detailTable.push([
                    chalk.yellow(item.zipcode),
                    primaryDist,
                    primaryLat,
                    primaryLon,
                    compareDist,
                    compareLat,
                    compareLon,
                    diff,
                    item.in_primary ? chalk.green('✓') : chalk.red('✗'),
                    item.in_compare ? chalk.green('✓') : chalk.red('✗')
                ]);
            });

            output += detailTable.toString();
        }

        return output;
    }
}

module.exports = RadiusSearchCommand;
