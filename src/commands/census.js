const { formatOutput, filterFields } = require('../utils/formatters');
const APIClient = require('../data/sources/api-client');
const zipcodes = require('zipcodes');

class CensusSearchCommand {
    constructor() {
        this.apiClient = new APIClient();
    }

    async execute(options) {
        const { zipcode, source = 'auto', fields, output = 'table' } = options;

        if (!zipcode) {
            throw new Error('--zipcode is required for census lookup');
        }

        try {
            // First, get the zipcode coordinates
            const zipData = await this.getZipcodeData(zipcode, source);
            if (!zipData) {
                throw new Error(`Could not find coordinates for zipcode ${zipcode}`);
            }

            // Get census tract data using the coordinates
            const censusData = await this.getCensusData(zipData);

            // Combine zipcode and census data
            const result = {
                zipcode: zipData.zipcode,
                city: zipData.city,
                state: zipData.state,
                latitude: zipData.latitude,
                longitude: zipData.longitude,
                ...censusData
            };

            // Apply field filtering if specified
            let processedResult = [result];
            if (fields) {
                processedResult = filterFields(processedResult, { fields });
            }

            // Format and return output
            return formatOutput(processedResult, output);

        } catch (error) {
            throw new Error(`Census lookup failed: ${error.message}`);
        }
    }

    async getZipcodeData(zipcode, source) {
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

    async getCensusData(zipData) {
        try {
            const censusResult = await this.apiClient.getCensusTract(
                zipData.latitude,
                zipData.longitude
            );

            if (censusResult) {
                return {
                    census_tract: censusResult.tract || '',
                    census_block: censusResult.block || '',
                    fips_state: censusResult.state_fips || '',
                    fips_county: censusResult.county_fips || '',
                    county_name: censusResult.county_name || ''
                };
            }

            return {
                census_tract: 'Not available',
                census_block: 'Not available',
                fips_state: 'Not available',
                fips_county: 'Not available',
                county_name: 'Not available'
            };

        } catch (error) {
            console.warn(`Census API lookup failed: ${error.message}`);
            return {
                census_tract: 'API error',
                census_block: 'API error',
                fips_state: 'API error',
                fips_county: 'API error',
                county_name: 'API error',
                error: error.message
            };
        }
    }
}

module.exports = CensusSearchCommand;
