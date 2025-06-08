#!/usr/bin/env node

const { program } = require('commander');
const pkg = require('../package.json');
const RadiusCommand = require('../src/commands/radius');
const LocationCommand = require('../src/commands/location');
const CensusCommand = require('../src/commands/census');
const BatchCommand = require('../src/commands/batch');

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
  .option('-o, --output <format>', 'Output format: json, csv, yaml, table', 'table')
  .option('--include-distance', 'Include distance in output', false)
  .option('--include-coordinates', 'Include latitude/longitude coordinates', false)
  .option('--include-city', 'Include city name', false)
  .option('--include-state', 'Include state', false)
  .option('--custom-field <field>', 'Include custom field from data')
  .action(async (options) => {
    const command = new RadiusCommand();
    try {
      const result = await command.execute({ zipcode: options.zip, miles: options.miles, ...options });
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
  .option('-o, --output <format>', 'Output format: json, csv, yaml, table', 'table')
  .option('--include-coordinates', 'Include latitude/longitude coordinates', false)
  .action(async (options) => {
    const command = new LocationCommand();
    try {
      const result = await command.execute(options);
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
  .option('-o, --output <format>', 'Output format: json, csv, yaml, table', 'table')
  .action(async (options) => {
    const command = new CensusCommand();
    try {
      const result = await command.execute({ zipcode: options.zip, ...options });
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
