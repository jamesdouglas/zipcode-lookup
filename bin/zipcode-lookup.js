#!/usr/bin/env node

const { program } = require('commander');
const pkg = require('../package.json');
const RadiusCommand = require('../src/commands/radius');
const LocationCommand = require('../src/commands/location');
const CensusCommand = require('../src/commands/census');
const BatchCommand = require('../src/commands/batch');
const ReverseCommand = require('../src/commands/reverse');

program
  .name('zipcode-lookup')
  .description(pkg.description)
  .version(pkg.version);

// Radius search command
program
  .command('radius')
  .description('Find zipcodes within a radius of a given zipcode')
  .requiredOption('-z, --zip <zipcode>', 'Base zipcode for radius search')
  .requiredOption('-m, --miles <distance>', 'Radius in miles', parseFloat)
  .option('-s, --source <type>', 'Data source: nominatim, zippopotam, zipcodes, local, auto', 'auto')
  .option('--compare <type>', 'Compare with another data source: nominatim, zippopotam, zipcodes')
  .option('--format <format>', 'Output format: json, csv, yaml, table', 'table')
  .option('--include-distance', 'Include distance in output', false)
  .option('--include-coordinates', 'Include latitude/longitude coordinates', false)
  .option('--include-city', 'Include city name', false)
  .option('--include-state', 'Include state', false)
  .option('--custom-field <field>', 'Include custom field from data')
  .option('--custom-value <value>', 'Value for custom field (requires --custom-field)')
  .option('--kml', 'Generate KML file for Google Earth', false)
  .action(async (options) => {
    const command = new RadiusCommand();
    try {
      // Map format option to output for backward compatibility with command implementations
      const result = await command.execute({
        zipcode: options.zip,
        miles: options.miles,
        output: options.format,
        ...options
      });
      console.log(result);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Location search command
program
  .command('location')
  .description('Find zipcodes by city, state, or county')
  .option('-c, --city <name>', 'City name')
  .option('-s, --state <code>', 'State code (e.g., CA, TX)')
  .option('--county <name>', 'County name')
  .option('--source <type>', 'Data source: nominatim, zippopotam, zipcodes, local, auto', 'auto')
  .option('--format <format>', 'Output format: json, csv, yaml, table', 'table')
  .option('--include-coordinates', 'Include latitude/longitude coordinates', false)
  .option('--kml', 'Generate KML file for Google Earth', false)
  .action(async (options) => {
    const command = new LocationCommand();
    try {
      // Map format option to output for backward compatibility with command implementations
      const result = await command.execute({ ...options, output: options.format });
      console.log(result);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Census tract command
program
  .command('census')
  .description('Get census tract information for zipcodes')
  .requiredOption('-z, --zip <zipcode>', 'Zipcode to lookup')
  .option('--include-boundaries', 'Include tract boundary coordinates', false)
  .option('--format <format>', 'Output format: json, csv, yaml, table', 'table')
  .action(async (options) => {
    const command = new CensusCommand();
    try {
      // Map format option to output for backward compatibility with command implementations
      const result = await command.execute({
        zipcode: options.zip,
        output: options.format,
        ...options
      });
      console.log(result);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Reverse lookup command
program
  .command('reverse')
  .description('Find the nearest zipcode for given coordinates')
  .requiredOption('--lat <latitude>', 'Latitude coordinate (-90 to 90)', parseFloat)
  .requiredOption('--lon <longitude>', 'Longitude coordinate (-180 to 180)', parseFloat)
  .option('-s, --source <type>', 'Data source: nominatim, zippopotam, zipcodes, auto', 'auto')
  .option('--compare <type>', 'Compare with another data source: nominatim, zippopotam, zipcodes')
  .option('--format <format>', 'Output format: json, csv, yaml, table', 'table')
  .option('--include-distance', 'Include distance from input coordinates', false)
  .option('--include-coordinates', 'Include zipcode center coordinates', false)
  .option('--nearest <count>', 'Number of nearest zipcodes to return', (value) => parseInt(value, 10), 1)
  .option('-m, --miles <distance>', 'Maximum distance in miles to include results', parseFloat)
  .option('--kml', 'Generate KML file for Google Earth', false)
  .action(async (options) => {
    const command = new ReverseCommand();
    try {
      if (process.env.DEBUG) {
        console.log('🔧 CLI options received:', JSON.stringify(options, null, 2));
      }
      // Map format option to output for backward compatibility with command implementations
      const result = await command.execute({
        lat: options.lat,
        lon: options.lon,
        output: options.format,
        ...options
      });
      console.log(result);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Batch processing command
program
  .command('batch')
  .description('Process multiple zipcodes from a CSV file')
  .requiredOption('-i, --input <file>', 'Input CSV file path')
  .requiredOption('-o, --output <file>', 'Output file path')
  .option('--source <type>', 'Data source: nominatim, zippopotam, zipcodes, local, auto', 'auto')
  .option('--chunk-size <size>', 'Processing chunk size', parseInt, 1000)
  .option('--progress', 'Show progress bar', false)
  .option('--operation <type>', 'Operation: radius, location, census, distance', 'radius')
  .option('--radius <miles>', 'Radius for batch radius operations', parseFloat, 10)
  .option('-m, --miles <distance>', 'Radius in miles (alias for --radius)', parseFloat)
  .option('--centroid-zipcode <zipcode>', 'Centroid zipcode for distance operations')
  .option('--include-distance', 'Include distance in output', false)
  .action(async (options) => {
    const command = new BatchCommand();
    try {
      // Support both --radius and --miles for consistency with radius command
      if (options.miles && !options.radius) {
        options.radius = options.miles;
      }
      const result = await command.execute(options);
      console.log(result);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Global options
program
  .option('--verbose', 'Enable verbose logging', false)
  .option('--cache', 'Enable caching for API responses', true)
  .option('--config <file>', 'Configuration file path');

program.parse();
