/**
 * Output formatting utilities for different formats
 */

const Papa = require('papaparse');
const yaml = require('js-yaml');
const Table = require('cli-table3');
const chalk = require('chalk');

/**
 * Format data for output based on specified format
 * @param {Array} data - Array of data objects
 * @param {string} format - Output format: json, csv, yaml, table
 * @param {Object} options - Formatting options
 * @returns {string} Formatted output
 */
function formatOutput(data, format = 'table', options = {}) {
  switch (format.toLowerCase()) {
    case 'json':
      return formatJSON(data, options);
    case 'csv':
      return formatCSV(data, options);
    case 'yaml':
      return formatYAML(data, options);
    case 'table':
      return formatTable(data, options);
    case 'raw':
      return data; // Return raw data array for programmatic use
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Format data as JSON
 * @param {Array} data - Data to format
 * @param {Object} options - Options for JSON formatting
 * @returns {string} JSON string
 */
function formatJSON(data, options = {}) {
  const indent = options.compact ? 0 : 2;
  return JSON.stringify(data, null, indent);
}

/**
 * Format data as CSV using Papa Parse
 * @param {Array} data - Data to format
 * @param {Object} options - Options for CSV formatting
 * @returns {string} CSV string
 */
function formatCSV(data, options = {}) {
  if (!data || data.length === 0) {
    return '';
  }

  const csvOptions = {
    header: true,
    delimiter: options.delimiter || ',',
    quotes: options.quotes !== false,
    ...options.papaOptions
  };

  return Papa.unparse(data, csvOptions);
}

/**
 * Format data as YAML
 * @param {Array} data - Data to format
 * @param {Object} options - Options for YAML formatting
 * @returns {string} YAML string
 */
function formatYAML(data, options = {}) {
  const yamlOptions = {
    indent: options.indent || 2,
    noArrayIndent: options.noArrayIndent || false,
    flowLevel: options.flowLevel || -1,
    ...options.yamlOptions
  };

  return yaml.dump(data, yamlOptions);
}

/**
 * Format data as a table
 * @param {Array} data - Data to format
 * @param {Object} options - Options for table formatting
 * @returns {string} Formatted table string
 */
function formatTable(data, options = {}) {
  if (!data || data.length === 0) {
    return chalk.yellow('No data to display');
  }

  // Extract headers from first object
  const headers = Object.keys(data[0]);

  // Create table configuration
  const tableConfig = {
    head: headers.map(h => chalk.cyan(h)),
    style: {
      head: [],
      border: []
    },
    ...options.tableOptions
  };

  const table = new Table(tableConfig);

  // Add rows
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];

      // Format specific types
      if (typeof value === 'number') {
        return chalk.green(value.toString());
      } else if (typeof value === 'boolean') {
        return value ? chalk.green('✓') : chalk.red('✗');
      } else if (value === null || value === undefined) {
        return chalk.gray('N/A');
      }

      return value.toString();
    });

    table.push(values);
  });

  return table.toString();
}

/**
 * Filter data fields based on include options
 * @param {Array} data - Source data
 * @param {Object} includeOptions - Fields to include
 * @returns {Array} Filtered data
 */
function filterFields(data, includeOptions = {}) {
  if (!data || data.length === 0) {
    return data;
  }

  // Base fields always included
  const baseFields = ['zipcode'];

  // Optional fields
  const optionalFields = [];

  if (includeOptions.includeDistance) optionalFields.push('distance');
  if (includeOptions.includeCoordinates) optionalFields.push('latitude', 'longitude');
  if (includeOptions.includeCity) optionalFields.push('city');
  if (includeOptions.includeState) optionalFields.push('state');
  if (includeOptions.customField) optionalFields.push(includeOptions.customField);

  // If no optional fields specified, include common ones
  if (optionalFields.length === 0) {
    optionalFields.push('city', 'state');
  }

  const fieldsToInclude = [...baseFields, ...optionalFields];

  return data.map(item => {
    const filtered = {};
    fieldsToInclude.forEach(field => {
      if (item.hasOwnProperty(field)) {
        filtered[field] = item[field];
      }
    });
    return filtered;
  });
}

/**
 * Create a summary of results
 * @param {Array} data - Data to summarize
 * @param {Object} options - Summary options
 * @returns {Object} Summary information
 */
function createSummary(data, options = {}) {
  if (!data || data.length === 0) {
    return {
      total: 0,
      message: 'No results found'
    };
  }

  const summary = {
    total: data.length,
    message: `Found ${data.length} result${data.length === 1 ? '' : 's'}`
  };

  // Add distance statistics if distance data is present
  if (data[0] && data[0].distance !== undefined) {
    const distances = data.map(item => item.distance).filter(d => d !== undefined);
    if (distances.length > 0) {
      summary.minDistance = Math.min(...distances);
      summary.maxDistance = Math.max(...distances);
      summary.avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
      summary.avgDistance = Math.round(summary.avgDistance * 100) / 100;
    }
  }

  return summary;
}

/**
 * Format summary information for display
 * @param {Object} summary - Summary object
 * @param {boolean} verbose - Include detailed statistics
 * @returns {string} Formatted summary
 */
function formatSummary(summary, verbose = false) {
  let output = chalk.blue.bold(`\n${summary.message}\n`);

  if (verbose && summary.total > 0) {
    if (summary.minDistance !== undefined) {
      output += chalk.gray(`Distance range: ${summary.minDistance} - ${summary.maxDistance} miles\n`);
      output += chalk.gray(`Average distance: ${summary.avgDistance} miles\n`);
    }
  }

  return output;
}

module.exports = {
  formatOutput,
  formatJSON,
  formatCSV,
  formatYAML,
  formatTable,
  filterFields,
  createSummary,
  formatSummary
};
