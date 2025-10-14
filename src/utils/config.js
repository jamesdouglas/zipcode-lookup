/**
 * Configuration management for zipcode lookup CLI
 * Handles environment variables, config files, and API keys
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class Config {
  constructor() {
    this.configCache = null;
    this.configPaths = [
      // Project-level config
      path.join(process.cwd(), 'config.json'),
      path.join(process.cwd(), 'zipcode-lookup.config.json'),
      path.join(process.cwd(), '.zipcode-lookup.json'),
      // User-level config
      path.join(os.homedir(), '.zipcode-lookup', 'config.json'),
      path.join(os.homedir(), '.zipcode-lookup.json')
    ];
  }

  /**
   * Load configuration from environment variables and config files
   * @returns {Object} Configuration object
   */
  load() {
    if (this.configCache) {
      return this.configCache;
    }

    const config = {
      // Google Maps API configuration
      googleMaps: {
        apiKey: process.env.GOOGLE_API_KEY || null,
        enabled: false,
        timeout: 10000,
        caching: true,
        cacheTTL: 300000 // 5 minutes
      },

      // Nominatim API configuration
      nominatim: {
        enabled: true,
        timeout: 30000,
        userAgent: 'zipcode-lookup-cli/1.0.0',
        caching: true,
        cacheTTL: 300000
      },

      // Zippopotam API configuration
      zippopotam: {
        enabled: true,
        timeout: 30000,
        caching: true,
        cacheTTL: 300000
      },

      // General API settings
      api: {
        retries: 3,
        retryDelay: 1000,
        maxConcurrent: 5
      },

      // Cache settings
      cache: {
        enabled: true,
        maxSize: 10000,
        ttl: 300000,
        cleanupInterval: 600000 // 10 minutes
      }
    };

    // Try to load from config files
    const fileConfig = this.loadFromFile();
    if (fileConfig) {
      this.mergeConfig(config, fileConfig);
    }

    // Enable Google Maps if API key is available
    if (config.googleMaps.apiKey) {
      config.googleMaps.enabled = true;
    }

    // Validate configuration
    this.validate(config);

    this.configCache = config;
    return config;
  }

  /**
   * Load configuration from the first available config file
   * @returns {Object|null} Configuration object or null if no file found
   */
  loadFromFile() {
    for (const configPath of this.configPaths) {
      try {
        if (fs.existsSync(configPath)) {
          const fileContent = fs.readFileSync(configPath, 'utf8');
          const config = JSON.parse(fileContent);
          console.log(`📁 Loaded configuration from ${configPath}`);
          return config;
        }
      } catch (error) {
        console.warn(`⚠️  Failed to load config from ${configPath}: ${error.message}`);
      }
    }
    return null;
  }

  /**
   * Create a sample configuration file
   * @param {string} targetPath - Path to create the config file
   */
  createSampleConfig(targetPath = null) {
    const sampleConfig = {
      googleMaps: {
        apiKey: "YOUR_GOOGLE_API_KEY_HERE",
        enabled: true,
        timeout: 10000,
        comment: "Get your API key from: https://console.developers.google.com/apis/credentials"
      },
      nominatim: {
        enabled: true,
        timeout: 30000,
        userAgent: "zipcode-lookup-cli/1.0.0"
      },
      zippopotam: {
        enabled: true,
        timeout: 30000
      },
      api: {
        retries: 3,
        retryDelay: 1000
      },
      cache: {
        enabled: true,
        ttl: 300000
      }
    };

    const outputPath = targetPath || path.join(process.cwd(), 'zipcode-lookup.config.json');

    try {
      // Ensure directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(outputPath, JSON.stringify(sampleConfig, null, 2));
      console.log(`✅ Sample configuration file created: ${outputPath}`);
      console.log('📝 Please edit the file and add your Google Maps API key');

      return outputPath;
    } catch (error) {
      throw new Error(`Failed to create config file: ${error.message}`);
    }
  }

  /**
   * Merge configuration objects deeply
   * @param {Object} target - Target configuration object
   * @param {Object} source - Source configuration object
   */
  mergeConfig(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== 'object') {
          target[key] = {};
        }
        this.mergeConfig(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  /**
   * Validate configuration
   * @param {Object} config - Configuration object to validate
   */
  validate(config) {
    // Validate Google Maps configuration
    if (config.googleMaps.enabled && !config.googleMaps.apiKey) {
      console.warn('⚠️  Google Maps is enabled but no API key found');
      console.warn('   Set GOOGLE_API_KEY environment variable or add to config file');
      config.googleMaps.enabled = false;
    }

    // Validate timeouts
    if (config.googleMaps.timeout < 1000) {
      console.warn('⚠️  Google Maps timeout is too low, setting to 10 seconds');
      config.googleMaps.timeout = 10000;
    }

    if (config.nominatim.timeout < 1000) {
      console.warn('⚠️  Nominatim timeout is too low, setting to 30 seconds');
      config.nominatim.timeout = 30000;
    }

    if (config.zippopotam.timeout < 1000) {
      console.warn('⚠️  Zippopotam timeout is too low, setting to 30 seconds');
      config.zippopotam.timeout = 30000;
    }
  }

  /**
   * Get specific configuration section
   * @param {string} section - Configuration section name
   * @returns {Object|null} Configuration section or null
   */
  get(section) {
    const config = this.load();
    return config[section] || null;
  }

  /**
   * Check if Google Maps is enabled and configured
   * @returns {boolean} True if Google Maps is available
   */
  isGoogleMapsEnabled() {
    const config = this.load();
    return config.googleMaps.enabled && !!config.googleMaps.apiKey;
  }

  /**
   * Get Google Maps API key
   * @returns {string|null} API key or null if not configured
   */
  getGoogleMapsApiKey() {
    const config = this.load();
    return config.googleMaps.enabled ? config.googleMaps.apiKey : null;
  }

  /**
   * Get list of available data sources based on configuration
   * @returns {Array} Array of available data source names
   */
  getAvailableDataSources() {
    const config = this.load();
    const sources = ['zipcodes', 'auto']; // Built-in sources always available

    if (config.nominatim.enabled) {
      sources.push('nominatim');
    }

    if (config.zippopotam.enabled) {
      sources.push('zippopotam');
    }

    if (config.googleMaps.enabled) {
      sources.push('googlemaps');
    }

    return sources;
  }

  /**
   * Clear configuration cache (for testing or reloading)
   */
  clearCache() {
    this.configCache = null;
  }

  /**
   * Get configuration status for debugging
   * @returns {Object} Configuration status object
   */
  getStatus() {
    const config = this.load();

    return {
      configLoaded: !!this.configCache,
      configFiles: this.configPaths.filter(p => fs.existsSync(p)),
      dataSources: {
        zipcodes: true, // Always available
        nominatim: config.nominatim.enabled,
        zippopotam: config.zippopotam.enabled,
        googleMaps: config.googleMaps.enabled
      },
      googleMaps: {
        configured: !!config.googleMaps.apiKey,
        enabled: config.googleMaps.enabled,
        fromEnvironment: !!process.env.GOOGLE_API_KEY
      }
    };
  }
}

module.exports = Config;
