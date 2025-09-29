const { formatOutput, filterFields } = require('../utils/formatters');
const APIClient = require('../data/sources/api-client');
const MapGenerator = require('../utils/map-generator');
const zipcodes = require('zipcodes');

class LocationSearchCommand {
    constructor() {
        this.apiClient = new APIClient();
        this.mapGenerator = new MapGenerator();
    }

    async execute(options) {
        const { city, state, county, source = 'auto', fields, output = 'table' } = options;

        if (!city && !county) {
            throw new Error('Either --city or --county must be specified');
        }

        if ((city || county) && !state) {
            throw new Error('--state is required when searching by city or county');
        }

        try {
            let results = [];

            if (city) {
                results = await this.searchByCity(city, state, source);
            } else if (county) {
                results = await this.searchByCounty(county, state, source);
            }

            if (!results || results.length === 0) {
                throw new Error(`No zipcodes found for the specified location`);
            }

            // Apply field filtering if specified
            if (fields) {
                results = filterFields(results, { fields });
            }

            // Generate KML if requested
            if (options.kml) {
                await this.mapGenerator.generateKmlFile(results, {
                    filename: `location-search-${Date.now()}.kml`
                });
            }

            // Format and return output
            return formatOutput(results, output);

        } catch (error) {
            throw new Error(`Location search failed: ${error.message}`);
        }
    }

    async searchByCity(city, state, source) {
        // Handle specific source requests
        if (source === 'nominatim') {
            return await this.searchCityViaNominatim(city, state);
        }

        if (source === 'zippopotam') {
            return await this.searchCityViaZippopotam(city, state);
        }

        // Default to zipcodes package (for 'zipcodes' source or 'auto' mode)
        try {
            const zipData = zipcodes.lookupByName(city, state);
            if (zipData && zipData.length > 0) {
                return zipData.map(zip => ({
                    zipcode: zip.zip,
                    city: zip.city,
                    state: zip.state,
                    latitude: zip.latitude,
                    longitude: zip.longitude
                }));
            }
        } catch (error) {
            console.warn(`Zipcodes package city search failed: ${error.message}`);
        }

        // If zipcodes package fails and we're in auto mode, try external APIs
        if (source === 'auto') {
            const results = await this.searchCityViaNominatim(city, state);
            if (results && results.length > 0) {
                console.log(`✅ Found ${city}, ${state} via external API fallback`);
                return results;
            }
        }

        return [];
    }

    async searchByCounty(county, state, source) {
        // Handle specific source requests
        if (source === 'nominatim') {
            return await this.searchCountyViaNominatim(county, state);
        }

        if (source === 'zippopotam') {
            // Zippopotam doesn't support county search, fallback to zipcodes
            return await this.searchCountyViaZipcodes(county, state);
        }

        // Default to zipcodes package search by filtering all zipcodes in state
        try {
            return await this.searchCountyViaZipcodes(county, state);
        } catch (error) {
            console.warn(`Zipcodes package county search failed: ${error.message}`);
        }

        // If zipcodes package fails and we're in auto mode, try external APIs
        if (source === 'auto') {
            const results = await this.searchCountyViaNominatim(county, state);
            if (results && results.length > 0) {
                console.log(`✅ Found ${county} County, ${state} via external API fallback`);
                return results;
            }
        }

        return [];
    }

    async searchCityViaNominatim(city, state) {
        try {
            const results = await this.apiClient.searchNominatimCity(city, state);
            return this.normalizeResults(results);
        } catch (error) {
            console.warn(`Nominatim city search failed: ${error.message}`);
            return [];
        }
    }

    async searchCityViaZippopotam(city, state) {
        try {
            const results = await this.apiClient.searchZippopotamCity(city, state);
            return this.normalizeResults(results);
        } catch (error) {
            console.warn(`Zippopotam city search failed: ${error.message}`);
            return [];
        }
    }

    async searchCountyViaZipcodes(county, state) {
        try {
            // Get all zipcodes for the state and filter by county
            const stateZipcodes = zipcodes.lookupByState(state);
            if (!stateZipcodes || stateZipcodes.length === 0) {
                return [];
            }

            const countyLower = county.toLowerCase();
            const matchingZipcodes = stateZipcodes.filter(zip => {
                // Handle different county name formats
                const zipCounty = zip.county ? zip.county.toLowerCase() : '';
                return zipCounty.includes(countyLower) ||
                       zipCounty.includes(countyLower.replace(' county', '')) ||
                       zipCounty === countyLower;
            });

            return matchingZipcodes.map(zip => ({
                zipcode: zip.zip,
                city: zip.city,
                state: zip.state,
                latitude: zip.latitude,
                longitude: zip.longitude,
                county: zip.county || ''
            }));
        } catch (error) {
            console.warn(`Zipcodes package county filter failed: ${error.message}`);
            return [];
        }
    }

    async searchCountyViaNominatim(county, state) {
        try {
            const results = await this.apiClient.searchNominatimCounty(county, state);
            return this.normalizeResults(results);
        } catch (error) {
            console.warn(`Nominatim county search failed: ${error.message}`);
            return [];
        }
    }

    normalizeResults(results) {
        if (!results || !Array.isArray(results)) {
            return [];
        }

        return results.map(result => ({
            zipcode: result.zipcode || result.zip,
            city: result.city,
            state: result.state,
            latitude: result.latitude,
            longitude: result.longitude,
            county: result.county || ''
        })).filter(result => result.zipcode && result.latitude && result.longitude);
    }
}

module.exports = LocationSearchCommand;
