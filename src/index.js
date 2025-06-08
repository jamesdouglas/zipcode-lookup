const RadiusSearchCommand = require('./commands/radius');
const LocationSearchCommand = require('./commands/location');
const CensusSearchCommand = require('./commands/census');
const BatchProcessingCommand = require('./commands/batch');
const APIClient = require('./data/sources/api-client');
const Cache = require('./utils/cache');
const zipcodes = require('zipcodes');

class ZipcodeLookup {
    constructor(options = {}) {
        this.cache = new Cache(options.cache);
        this.apiClient = new APIClient(options.api);

        // Command instances
        this.commands = {
            radius: new RadiusSearchCommand(),
            location: new LocationSearchCommand(),
            census: new CensusSearchCommand(),
            batch: new BatchProcessingCommand()
        };
    }

    async initialize() {
        try {
            await this.cache.initialize();
            console.log('✅ Zipcode lookup initialized - using built-in zipcodes package');
            return true;
        } catch (error) {
            console.error('Initialization failed:', error.message);
            return false;
        }
    }

    async executeCommand(commandName, options) {
        if (!this.commands[commandName]) {
            throw new Error(`Unknown command: ${commandName}`);
        }

        try {
            const command = this.commands[commandName];
            const result = await command.execute(options);
            return result;
        } catch (error) {
            throw new Error(`Command execution failed: ${error.message}`);
        }
    }

    async testConnections() {
        const results = {
            zipcodesPackage: false,
            apiClient: false,
            cache: false
        };

        // Test zipcodes package
        try {
            const testResult = zipcodes.lookup('90210');
            results.zipcodesPackage = testResult !== null && testResult.latitude;
        } catch (error) {
            console.warn('Zipcodes package test failed:', error.message);
        }

        // Test API client
        try {
            const testResult = await this.apiClient.getZipcode('90210');
            results.apiClient = testResult !== null;
        } catch (error) {
            console.warn('API client test failed:', error.message);
        }

        // Test cache
        try {
            await this.cache.set('test', 'data', { ttl: 1000 });
            const cachedData = await this.cache.get('test');
            results.cache = cachedData === 'data';
        } catch (error) {
            console.warn('Cache test failed:', error.message);
        }

        return results;
    }

    async getAvailableDataSources() {
        const connections = await this.testConnections();
        const sources = [];

        if (connections.zipcodesPackage) {
            sources.push({
                name: 'zipcodes',
                type: 'built-in',
                status: 'available',
                features: ['zipcode_lookup', 'radius_search', 'location_search', 'distance_calculation']
            });
        }

        if (connections.apiClient) {
            sources.push({
                name: 'nominatim',
                type: 'external',
                status: 'available',
                features: ['zipcode_lookup', 'location_search']
            });

            sources.push({
                name: 'zippopotam',
                type: 'external',
                status: 'available',
                features: ['zipcode_lookup']
            });
        }

        return sources;
    }

    async cleanup() {
        try {
            // Cleanup cache
            await this.cache.cleanup();
        } catch (error) {
            console.warn('Cleanup warning:', error.message);
        }
    }

    getStats() {
        return {
            cache: this.cache.getStats(),
            availableCommands: Object.keys(this.commands),
            dataSources: ['zipcodes', 'nominatim', 'zippopotam', 'auto'],
            version: require('../package.json').version
        };
    }
}

// Factory function for easy instantiation
function createZipcodeLookup(options = {}) {
    return new ZipcodeLookup(options);
}

// Main execution function for CLI usage
async function main(command, options = {}) {
    const app = createZipcodeLookup();

    try {
        await app.initialize();
        const result = await app.executeCommand(command, options);
        await app.cleanup();
        return result;
    } catch (error) {
        await app.cleanup();
        throw error;
    }
}

module.exports = {
    ZipcodeLookup,
    createZipcodeLookup,
    main
};