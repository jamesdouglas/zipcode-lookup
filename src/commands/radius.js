const { formatOutput, filterFields } = require('../utils/formatters');
const { calculateDistance } = require('../utils/distance');
const APIClient = require('../data/sources/api-client');
const zipcodes = require('zipcodes');

class RadiusSearchCommand {
    constructor() {
        this.apiClient = new APIClient();
    }

    async execute(options) {
        const { zipcode, miles, kilometers, source = 'auto', includeDistance, fields, output = 'table' } = options;

        // Convert distance to common unit (miles)
        const radiusMiles = kilometers ? kilometers * 0.621371 : miles;

        if (!radiusMiles) {
            throw new Error('Distance must be specified in either --miles or --kilometers');
        }

        try {
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
}

module.exports = RadiusSearchCommand;