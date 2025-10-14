const { formatOutput, filterFields } = require('../utils/formatters');
const { calculateDistance } = require('../utils/distance');
const APIClient = require('../data/sources/api-client');
const CoordinateGrid = require('../utils/coordinate-grid');
const MapGenerator = require('../utils/map-generator');
const zipcodes = require('zipcodes');

class ReverseCommand {
    constructor() {
        this.apiClient = new APIClient();
        this.mapGenerator = new MapGenerator();
    }

    async execute(options) {
        if (process.env.DEBUG) {
            console.log('🔧 Execute options:', JSON.stringify(options, null, 2));
            console.log('🔑 Option keys:', Object.keys(options));
        }

        const {
            lat,
            lon,
            source = 'auto',
            compare,
            fields,
            output = 'table',
            includeDistance = false,
            includeCoordinates = false,
            nearest: nearestRaw = 1,
            miles
        } = options;

        // Validate that --nearest and --miles are mutually exclusive
        if (nearestRaw && nearestRaw !== 1 && miles) {
            throw new Error('Cannot use both --nearest and --miles options together. Use --nearest for closest N zipcodes or --miles for all zipcodes within distance.');
        }

        // Handle null/undefined nearest value - check if it's null but we might have it in a different key
        let nearest = 1;
        if (nearestRaw != null && !isNaN(nearestRaw)) {
            nearest = nearestRaw;
        } else if (nearestRaw != null) {
            const parsed = parseInt(nearestRaw);
            if (!isNaN(parsed)) {
                nearest = parsed;
            }
        }

        // Check if nearest value is available in options directly
        if (nearest === 1 && options.nearest != null && !isNaN(options.nearest)) {
            nearest = parseInt(options.nearest) || 1;
        }

        // When using --miles, we want ALL zipcodes within that distance, not just nearest N
        if (miles && miles > 0) {
            nearest = 1000; // Set high number to get many candidates for filtering
        }

        if (process.env.DEBUG) {
            console.log(`🔢 Parsed nearest value: ${nearest} (type: ${typeof nearest})`);
            if (miles) {
                console.log(`📏 Miles filtering enabled: ${miles} miles`);
            }
        }

        // Validate coordinates
        this.validateCoordinates(lat, lon);

        try {
            if (compare) {
                return await this.executeComparison(lat, lon, source, compare, options);
            }

            // Single or multiple source lookup
            const results = await this.findNearestZipcodes(lat, lon, source, nearest);

            if (!results || results.length === 0) {
                throw new Error(`No zipcode found for coordinates ${lat}, ${lon}`);
            }

            // Add optional fields to all results
            for (const result of results) {
                if (includeDistance || miles) {
                    result.distance_miles = calculateDistance(lat, lon, result.latitude, result.longitude);
                }

                // Always include coordinates for reverse lookup, rename for clarity
                result.lat = result.latitude;
                result.lon = result.longitude;

                if (!includeCoordinates) {
                    delete result.latitude;
                    delete result.longitude;
                }

                // Remove county field (usually empty and not useful for reverse lookup)
                delete result.county;
            }

            // Filter by distance if miles parameter is specified
            let filteredResults = results;
            if (miles && miles > 0) {
                filteredResults = results.filter(result => {
                    const distance = result.distance_miles || calculateDistance(lat, lon, result.lat, result.lon);
                    return distance <= miles;
                });

                if (process.env.DEBUG) {
                    console.log(`🎯 Filtered ${results.length} results to ${filteredResults.length} within ${miles} miles`);
                }

                if (filteredResults.length === 0) {
                    throw new Error(`No zipcodes found within ${miles} miles of coordinates ${lat}, ${lon}`);
                }
            }

            // Sort by distance when distance is included
            if (includeDistance || miles) {
                filteredResults.sort((a, b) => {
                    const distanceA = a.distance_miles || 0;
                    const distanceB = b.distance_miles || 0;
                    return distanceA - distanceB;
                });
            }

            // Apply field filtering if specified
            let finalResults = filteredResults;
            if (fields) {
                finalResults = filterFields(filteredResults, { fields });
            }

            // Generate KML if requested
            if (options.kml) {
                const centerPoint = { latitude: lat, longitude: lon };
                await this.mapGenerator.generateKmlFile(finalResults, {
                    centerPoint: centerPoint,
                    filename: `reverse-lookup-${lat}-${lon}.kml`
                });
            }

            return formatOutput(finalResults, output);

        } catch (error) {
            throw new Error(`Reverse lookup failed: ${error.message}`);
        }
    }

    async executeComparison(lat, lon, primarySource, compareSource, options) {
        const { output = 'table', includeDistance = false, miles } = options;

        // Get results from both sources
        const primaryResult = await this.findNearestZipcode(lat, lon, primarySource);
        const compareResult = await this.findNearestZipcode(lat, lon, compareSource);

        if (!primaryResult && !compareResult) {
            throw new Error(`No zipcode found by either source for coordinates ${lat}, ${lon}`);
        }

        // Calculate distances
        const primaryDistance = primaryResult ?
            calculateDistance(lat, lon, primaryResult.latitude, primaryResult.longitude) : null;
        const compareDistance = compareResult ?
            calculateDistance(lat, lon, compareResult.latitude, compareResult.longitude) : null;

        // Filter by miles if specified
        let filteredPrimaryResult = primaryResult;
        let filteredCompareResult = compareResult;

        if (miles && miles > 0) {
            if (primaryResult && primaryDistance > miles) {
                filteredPrimaryResult = null;
                if (process.env.DEBUG) {
                    console.log(`🎯 Primary result ${primaryResult.zipcode} filtered out: ${primaryDistance.toFixed(2)} miles > ${miles} miles`);
                }
            }
            if (compareResult && compareDistance > miles) {
                filteredCompareResult = null;
                if (process.env.DEBUG) {
                    console.log(`🎯 Compare result ${compareResult.zipcode} filtered out: ${compareDistance.toFixed(2)} miles > ${miles} miles`);
                }
            }

            if (!filteredPrimaryResult && !filteredCompareResult) {
                throw new Error(`No zipcodes found within ${miles} miles of coordinates ${lat}, ${lon}`);
            }
        }

        // Build comparison output
        let comparisonOutput = `Reverse Lookup Comparison: ${lat}, ${lon}\n`;
        comparisonOutput += `Primary Source: ${primarySource}\n`;
        comparisonOutput += `Compare Source: ${compareSource}\n`;
        if (miles) {
            comparisonOutput += `Maximum Distance: ${miles} miles\n`;
        }
        comparisonOutput += `\n`;

        if (output === 'table') {
            comparisonOutput += this.formatComparisonTable(
                filteredPrimaryResult, filteredCompareResult,
                filteredPrimaryResult ? primaryDistance : null, filteredCompareResult ? compareDistance : null,
                primarySource, compareSource
            );
        } else {
            // For non-table formats, return structured data
            const comparisonData = {
                coordinates: { latitude: lat, longitude: lon },
                primary_source: primarySource,
                compare_source: compareSource,
                maximum_distance_miles: miles || null,
                results: {
                    primary: filteredPrimaryResult ? {
                        ...filteredPrimaryResult,
                        distance_miles: primaryDistance
                    } : null,
                    compare: filteredCompareResult ? {
                        ...filteredCompareResult,
                        distance_miles: compareDistance
                    } : null
                }
            };
            return formatOutput(comparisonData, output);
        }

        return comparisonOutput;
    }

    async findNearestZipcodes(lat, lon, source, count = 1) {
        // Handle specific source requests
        if (source === 'nominatim') {
            const result = await this.findNearestViaNominatim(lat, lon);
            return result ? [result] : [];
        }

        if (source === 'googlemaps') {
            const result = await this.findNearestViaGoogleMaps(lat, lon);
            return result ? [result] : [];
        }

        if (source === 'zippopotam') {
            const result = await this.findNearestViaZippopotam(lat, lon);
            return result ? [result] : [];
        }

        // Default to zipcodes package (for 'zipcodes' source or 'auto' mode)
        try {
            const results = await this.findNearestViaZipcodesMultiple(lat, lon, count);
            if (results && results.length > 0) {
                return results;
            }
        } catch (error) {
            console.warn(`Zipcodes package reverse lookup failed: ${error.message}`);
        }

        // If zipcodes package fails and we're in auto mode, try external APIs
        if (source === 'auto') {
            const result = await this.findNearestViaNominatim(lat, lon);
            if (result) {
                console.log(`✅ Found reverse lookup via Nominatim`);
                return [result];
            }
        }

        return [];
    }

    async findNearestZipcode(lat, lon, source) {
        const results = await this.findNearestZipcodes(lat, lon, source, 1);
        return results.length > 0 ? results[0] : null;
    }

    async findNearestViaZipcodesMultiple(lat, lon, count = 1) {
        try {
            // Use coordinate grid to find candidate states (major performance optimization)
            const coordinateGrid = new CoordinateGrid();
            const candidateStates = coordinateGrid.getCandidateStates(lat, lon);

            if (process.env.DEBUG) {
                console.log(`🗺️ Coordinate grid optimization: searching ${candidateStates.length} states instead of 50`);
                console.log(`📍 Candidate states: ${candidateStates.join(', ')}`);
            }

            let candidates = [];

            // Collect all zipcodes with distances from candidate states
            for (const state of candidateStates) {
                try {
                    const stateZipcodes = zipcodes.lookupByState(state);
                    if (process.env.DEBUG) {
                        console.log(`📋 Found ${stateZipcodes?.length || 0} zipcodes for state ${state}`);
                    }
                    if (stateZipcodes && stateZipcodes.length > 0) {
                        for (const zipData of stateZipcodes) {
                            if (zipData.latitude && zipData.longitude) {
                                const distance = calculateDistance(lat, lon, zipData.latitude, zipData.longitude);

                                candidates.push({
                                    zipcode: zipData.zip,
                                    city: zipData.city,
                                    state: zipData.state,
                                    latitude: zipData.latitude,
                                    longitude: zipData.longitude,
                                    county: '',
                                    distance: distance
                                });
                            }
                        }
                    }
                } catch (stateError) {
                    // Continue with other states if one fails
                    console.warn(`Failed to get zipcodes for state ${state}: ${stateError.message}`);
                }
            }

            if (process.env.DEBUG) {
                console.log(`🎯 Found ${candidates.length} total candidates`);
            }

            // If not enough results in candidate states, expand search to nearby states
            if (candidates.length < count) {
                if (process.env.DEBUG) {
                    console.log(`🔍 Only found ${candidates.length} results in candidate states, expanding search to nearby states`);
                }
                const nearbyStates = coordinateGrid.findNearestStates(lat, lon, 5);

                for (const state of nearbyStates) {
                    if (candidateStates.includes(state)) continue; // Skip already searched states

                    try {
                        const stateZipcodes = zipcodes.lookupByState(state);
                        if (stateZipcodes && stateZipcodes.length > 0) {
                            for (const zipData of stateZipcodes) {
                                if (zipData.latitude && zipData.longitude) {
                                    const distance = calculateDistance(lat, lon, zipData.latitude, zipData.longitude);

                                    candidates.push({
                                        zipcode: zipData.zip,
                                        city: zipData.city,
                                        state: zipData.state,
                                        latitude: zipData.latitude,
                                        longitude: zipData.longitude,
                                        county: '',
                                        distance: distance
                                    });
                                }
                            }
                        }
                    } catch (stateError) {
                        console.warn(`Failed to get zipcodes for state ${state}: ${stateError.message}`);
                    }
                }
            }

            // Sort by distance and return top N results
            candidates.sort((a, b) => a.distance - b.distance);
            const results = candidates.slice(0, count).map(candidate => {
                const { distance, ...zipcode } = candidate;
                return zipcode;
            });

            if (process.env.DEBUG) {
                console.log(`🎯 After sorting: closest ${Math.min(3, candidates.length)} distances: ${candidates.slice(0, 3).map(c => c.distance.toFixed(4)).join(', ')}`);
                console.log(`📦 Returning ${results.length} results, requested ${count}`);
            }

            if (results.length > 0 && process.env.DEBUG) {
                console.log(`✅ Found ${results.length} nearest zipcodes, closest is ${results[0].zipcode} at ${candidates[0].distance.toFixed(2)} miles`);
            }

            return results;
        } catch (error) {
            console.warn(`Zipcodes package reverse lookup failed: ${error.message}`);
            return [];
        }
    }

    async findNearestViaZipcodes(lat, lon) {
        const results = await this.findNearestViaZipcodesMultiple(lat, lon, 1);
        return results.length > 0 ? results[0] : null;
    }

    async findNearestViaNominatim(lat, lon) {
        try {
            const result = await this.apiClient.reverseGeocode(lat, lon);
            return result;
        } catch (error) {
            console.warn(`Nominatim reverse lookup failed: ${error.message}`);
            return null;
        }
    }

    async findNearestViaGoogleMaps(lat, lon) {
        try {
            const result = await this.apiClient.reverseGeocodeGoogleMaps(lat, lon);
            return result;
        } catch (error) {
            console.warn(`Google Maps reverse lookup failed: ${error.message}`);
            return null;
        }
    }

    async findNearestViaZippopotam(lat, lon) {
        try {
            // Zippopotam doesn't have reverse geocoding, so we'll use the zipcodes package
            // as a fallback but mark it as from zippopotam source
            const result = await this.findNearestViaZipcodes(lat, lon);
            if (result) {
                // Verify with Zippopotam if possible (get the zipcode data to confirm)
                const zipData = await this.apiClient.getZippopotamZipcode(result.zipcode);
                if (zipData) {
                    return {
                        ...result,
                        latitude: zipData.latitude,
                        longitude: zipData.longitude,
                        city: zipData.city,
                        state: zipData.state
                    };
                }
            }
            return result;
        } catch (error) {
            console.warn(`Zippopotam reverse lookup failed: ${error.message}`);
            return null;
        }
    }

    formatComparisonTable(primaryResult, compareResult, primaryDistance, compareDistance, primarySource, compareSource) {
        const Table = require('cli-table3');

        const table = new Table({
            head: ['Source', 'Zipcode', 'City', 'State', 'Distance', 'Zipcode Lat', 'Zipcode Lon', 'Diff'],
            style: {
                head: ['cyan'],
                border: ['grey']
            }
        });

        // Primary source row
        if (primaryResult) {
            table.push([
                primarySource,
                primaryResult.zipcode,
                primaryResult.city,
                primaryResult.state,
                primaryDistance ? primaryDistance.toFixed(2) : 'N/A',
                primaryResult.latitude ? primaryResult.latitude.toFixed(6) : 'N/A',
                primaryResult.longitude ? primaryResult.longitude.toFixed(6) : 'N/A',
                '-'
            ]);
        } else {
            table.push([primarySource, 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A']);
        }

        // Compare source row
        if (compareResult) {
            let diff = 'N/A';
            if (primaryDistance !== null && compareDistance !== null) {
                const distanceDiff = compareDistance - primaryDistance;
                diff = (distanceDiff >= 0 ? '+' : '') + distanceDiff.toFixed(2);
            }

            table.push([
                compareSource,
                compareResult.zipcode,
                compareResult.city,
                compareResult.state,
                compareDistance ? compareDistance.toFixed(2) : 'N/A',
                compareResult.latitude ? compareResult.latitude.toFixed(6) : 'N/A',
                compareResult.longitude ? compareResult.longitude.toFixed(6) : 'N/A',
                diff
            ]);
        } else {
            table.push([compareSource, 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A']);
        }

        return `Nearest Zipcode Results:\n${table.toString()}`;
    }

    validateCoordinates(lat, lon) {
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lon);

        if (isNaN(latitude) || isNaN(longitude)) {
            throw new Error('Latitude and longitude must be valid numbers');
        }

        if (latitude < -90 || latitude > 90) {
            throw new Error('Latitude must be between -90 and 90 degrees');
        }

        if (longitude < -180 || longitude > 180) {
            throw new Error('Longitude must be between -180 and 180 degrees');
        }
    }
}

module.exports = ReverseCommand;
