const { formatOutput, filterFields } = require('../utils/formatters');
const { calculateDistance } = require('../utils/distance');
const APIClient = require('../data/sources/api-client');
const MapGenerator = require('../utils/map-generator');
const zipcodes = require('zipcodes');

class RadiusSearchCommand {
    constructor() {
        this.apiClient = new APIClient();
        this.mapGenerator = new MapGenerator();
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

            // Generate KML if requested
            if (options.kml) {
                await this.mapGenerator.generateKmlFile(processedResults, {
                    centerPoint: centerPoint,
                    source: source,
                    filename: `radius-${zipcode}-${radiusMiles}mi.kml`
                });
            }

            // Format and return output
            return formatOutput(processedResults, output);

        } catch (error) {
            throw new Error(`Radius search failed: ${error.message}`);
        }
    }

    async executeComparison(zipcode, source, compareSource, radiusMiles, options) {
        const { output = 'table' } = options;
        // When comparing, we always want to include distance details.
        const includeDistance = true;

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
            const primaryZipcodes = new Set(await this.getZipcodesInRadius(primaryPoint, radiusMiles));
            const compareZipcodes = new Set(await this.getZipcodesInRadius(comparePoint, radiusMiles));

            // Combine zipcodes from both sources
            const allZipcodes = new Set([...primaryZipcodes, ...compareZipcodes]);

            // Get full data for all zipcodes from both sources
            const primaryResults = await this.getZipcodeData(allZipcodes, source);
            const compareResults = await this.getZipcodeData(allZipcodes, compareSource);

            // Process both result sets, indicating this is a comparison
            const primaryProcessed = this.processResults(primaryResults, primaryPoint, radiusMiles, true, true);
            const compareProcessed = this.processResults(compareResults, comparePoint, radiusMiles, true, true);

            // Filter out results that are outside the radius in BOTH sources
            const combinedProcessed = this.filterCombinedRadius(primaryProcessed, compareProcessed, radiusMiles);
            const finalPrimary = combinedProcessed.primary;
            const finalCompare = combinedProcessed.compare;

            // Build comparison output
            const comparisonData = {
                zipcode: zipcode,
                radius_miles: radiusMiles,
                source_comparison: {
                    primary_source: primaryPoint.source,
                    compare_source: comparePoint.source,
                    coordinate_difference_miles: parseFloat(coordinateDifference.toFixed(4))
                },
                coordinates: {
                    primary: {
                        source: primaryPoint.source,
                        latitude: primaryPoint.latitude,
                        longitude: primaryPoint.longitude,
                        city: primaryPoint.city,
                        state: primaryPoint.state
                    },
                    compare: {
                        source: comparePoint.source,
                        latitude: comparePoint.latitude,
                        longitude: comparePoint.longitude,
                        city: comparePoint.city,
                        state: comparePoint.state
                    }
                },
                results_summary: {
                    primary_count: finalPrimary.length,
                    compare_count: finalCompare.length,
                    difference: finalPrimary.length - finalCompare.length
                }
            };

            // If distance is requested, include detailed comparison
            if (includeDistance) {
                comparisonData.detailed_comparison = this.buildDetailedComparison(
                    finalPrimary,
                    finalCompare,
                    primaryPoint.source,
                    comparePoint.source
                );
            }

            // Generate KML if requested
            if (options.kml) {
                await this.mapGenerator.generateKmlFile(finalPrimary, {
                    centerPoint: primaryPoint,
                    compareResults: finalCompare,
                    source: primaryPoint.source,
                    compareSource: comparePoint.source,
                    filename: `radius-comparison-${zipcode}-${radiusMiles}mi.kml`
                });
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

    filterCombinedRadius(primaryResults, compareResults, radiusMiles) {
        const primaryMap = new Map(primaryResults.map(r => [r.zipcode, r]));
        const compareMap = new Map(compareResults.map(r => [r.zipcode, r]));
        const allZipcodes = new Set([...primaryMap.keys(), ...compareMap.keys()]);

        const finalPrimary = [];
        const finalCompare = [];

        for (const zipcode of allZipcodes) {
            const primary = primaryMap.get(zipcode);
            const compare = compareMap.get(zipcode);

            const inPrimaryRadius = primary && primary.distance_miles <= radiusMiles;
            const inCompareRadius = compare && compare.distance_miles <= radiusMiles;

            if (inPrimaryRadius || inCompareRadius) {
                if (primary) {
                    finalPrimary.push(primary);
                }
                if (compare) {
                    finalCompare.push(compare);
                }
            }
        }

        return { primary: finalPrimary, compare: finalCompare };
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
                    comparisonEntry.primary_distance = primaryResult.distance_miles || 0;
                    comparisonEntry.primary_coordinates = {
                        latitude: primaryResult.latitude,
                        longitude: primaryResult.longitude
                    };
                }

                if (compareResult) {
                    comparisonEntry.compare_distance = compareResult.distance_miles || 0;
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

            // Sort by primary source distance (ascending)
            return comparison.sort((a, b) => {
                const primaryDistA = a.primary_distance !== undefined ? a.primary_distance : Infinity;
                const primaryDistB = b.primary_distance !== undefined ? b.primary_distance : Infinity;
                return primaryDistA - primaryDistB;
            });
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
                    state: result.state,
                    source: 'nominatim'
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
                    state: result.state,
                    source: 'zippopotam'
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
                    state: zipData.state,
                    source: 'zipcodes'
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
                    state: result.state,
                    source: result.source // The API client now returns the source
                };
            }
        }

        return null;
    }

    async getZipcodeData(zipcodes, source) {
        const results = [];
        for (const zipcode of zipcodes) {
            try {
                const data = await this.getCenterPoint(zipcode, source);
                if (data) {
                    results.push(data);
                }
            } catch (error) {
                if (process.env.DEBUG) {
                    console.warn(`Could not retrieve data for zipcode ${zipcode} from source ${source}: ${error.message}`);
                }
            }
        }
        return results;
    }

    async getZipcodesInRadius(centerPoint, radiusMiles) {
        try {
            // Use the zipcodes package to get a list of zipcodes within the radius
            return zipcodes.radius(centerPoint.zipcode, radiusMiles);
        } catch (error) {
            // Fallback to using coordinates if the zipcode isn't in the local package
            console.warn(`Zipcode ${centerPoint.zipcode} not found in local data, falling back to coordinate-based radius search.`);
            try {
                return zipcodes.radius({ lat: centerPoint.latitude, lon: centerPoint.longitude }, radiusMiles);
            } catch (coordError) {
                console.error(`Coordinate-based radius search failed: ${coordError.message}`);
                return [];
            }
        }
    }

    async findZipcodesInRadius(centerPoint, radiusMiles, source) {
        // Handle API-specific sources
        if (source === 'nominatim' || source === 'zippopotam') {
            // APIs don't support radius search, so get list from zipcodes package
            // but fetch coordinates from the specified source
            return await this.zipcodesRadiusSearchWithSourceCoords(centerPoint, radiusMiles, source);
        }

        // Use zipcodes package for radius search (default and most efficient)
        return await this.zipcodesRadiusSearch(centerPoint, radiusMiles);
    }

    async zipcodesRadiusSearchWithSourceCoords(centerPoint, radiusMiles, source) {
        try {
            // First get list of zipcodes in radius using zipcodes package
            const nearbyZipArray = zipcodes.radius(centerPoint.zipcode, radiusMiles);
            const nearbyZipcodes = [];

            for (const zipcode of nearbyZipArray) {
                try {
                    // Get coordinates from the specified source instead of zipcodes package
                    const sourceData = await this.getCenterPoint(zipcode, source);
                    if (sourceData) {
                        nearbyZipcodes.push({
                            zipcode: sourceData.zipcode,
                            latitude: sourceData.latitude,
                            longitude: sourceData.longitude,
                            city: sourceData.city,
                            state: sourceData.state
                        });
                    }
                } catch (error) {
                    // If source fails, don't add fallback data for comparison sources
                    // This prevents identical coordinates with different distances
                    console.warn(`Failed to get ${zipcode} from ${source}, excluding from ${source} results`);
                }
            }

            return nearbyZipcodes;
        } catch (error) {
            console.warn(`Source-specific radius search failed: ${error.message}`);
            // Fall back to standard zipcodes search
            return await this.zipcodesRadiusSearch(centerPoint, radiusMiles);
        }
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
