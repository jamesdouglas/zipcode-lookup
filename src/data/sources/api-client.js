/**
 * API client for external zipcode and census data services
 */

const axios = require('axios');
const Config = require('../../utils/config');

class APIClient {
  constructor(options = {}) {
    this.config = new Config();
    const configData = this.config.load();

    this.baseTimeout = options.timeout || 30000;
    this.retries = options.retries || configData.api.retries;
    this.cache = new Map();
    this.cacheTTL = options.cacheTTL || configData.cache.ttl;

    // Google Maps configuration
    this.googleMapsConfig = configData.googleMaps;

    // Debug logging for Google Maps configuration
    if (process.env.DEBUG) {
      console.log('🔧 Google Maps Config:', {
        enabled: this.googleMapsConfig.enabled,
        hasApiKey: !!this.googleMapsConfig.apiKey,
        apiKeyLength: this.googleMapsConfig.apiKey ? this.googleMapsConfig.apiKey.length : 0,
        timeout: this.googleMapsConfig.timeout
      });
    }
  }

  /**
   * Get zipcode data from Zippopotam.us API specifically
   * @param {string} zipcode - Zipcode to lookup
   * @returns {Promise<Object|null>} Zipcode data
   */
  async getZippopotamZipcode(zipcode) {
    try {
      const response = await axios.get(`https://api.zippopotam.us/us/${zipcode}`, {
        timeout: this.baseTimeout
      });

      const data = this.transformZippopotamData(response.data);
      return data;
    } catch (error) {
      console.error(`Zippopotam API error for zipcode ${zipcode}:`, error.message);
      return null;
    }
  }

  /**
   * Get zipcode data from Google Maps Geocoding API specifically
   * @param {string} zipcode - Zipcode to lookup
   * @returns {Promise<Object|null>} Zipcode data
   */
  async getGoogleMapsZipcode(zipcode) {
    if (!this.googleMapsConfig.enabled || !this.googleMapsConfig.apiKey) {
      const message = !this.googleMapsConfig.enabled
        ? 'Google Maps API is disabled in configuration'
        : 'Google Maps API key is not configured';
      throw new Error(`${message}. Please set GOOGLE_API_KEY environment variable or add to config.json.`);
    }

    if (process.env.DEBUG) {
      console.log(`🗺️ Attempting Google Maps lookup for zipcode: ${zipcode}`);
    }

    try {
      // Try different address formats for better results
      const addressFormats = [
        zipcode, // Simple zipcode
        `${zipcode}, USA`, // Zipcode with country
        `${zipcode}, United States` // Full country name
      ];

      for (let i = 0; i < addressFormats.length; i++) {
        const address = addressFormats[i];

        if (process.env.DEBUG) {
          console.log(`🔍 Trying address format ${i + 1}/${addressFormats.length}: "${address}"`);
        }

        const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
          params: {
            address: address,
            components: 'country:US',
            key: this.googleMapsConfig.apiKey
          },
          timeout: this.googleMapsConfig.timeout
        });

        if (process.env.DEBUG) {
          console.log(`📊 Google Maps API response status: ${response.data.status}`);
          console.log(`📊 Google Maps API results count: ${response.data.results?.length || 0}`);
        }

        if (response.data.status === 'OVER_QUERY_LIMIT') {
          throw new Error('Google Maps API quota exceeded');
        }

        if (response.data.status === 'REQUEST_DENIED') {
          throw new Error('Google Maps API request denied - check API key and billing');
        }

        if (response.data.status === 'INVALID_REQUEST') {
          console.warn(`Google Maps API invalid request for address: ${address}`);
          continue; // Try next format
        }

        if (response.data.status === 'ZERO_RESULTS') {
          if (process.env.DEBUG) {
            console.log(`⚠️ No results for address format: ${address}`);
          }
          continue; // Try next format
        }

        if (response.data.status === 'OK' && response.data.results.length > 0) {
          const result = this.transformGoogleMapsData(response.data.results[0], zipcode);
          if (result) {
            if (process.env.DEBUG) {
              console.log(`✅ Successfully found Google Maps data for ${zipcode}:`, {
                lat: result.latitude,
                lng: result.longitude,
                city: result.city,
                state: result.state
              });
            }
            return result;
          }
        }
      }

      // If no results from any format, return null
      console.warn(`Google Maps API could not find any results for zipcode ${zipcode}`);
      return null;
    } catch (error) {
      if (error.message.includes('quota') || error.message.includes('denied')) {
        throw error; // Re-throw API-specific errors
      }
      console.error(`Google Maps API error for zipcode ${zipcode}:`, error.message);
      if (process.env.DEBUG) {
        console.error('Full error details:', error);
      }
      return null;
    }
  }

  /**
   * Get zipcode data from external API with multiple fallbacks
   * @param {string} zipcode - Zipcode to lookup
   * @returns {Promise<Object|null>} Zipcode data
   */
  async getZipcode(zipcode) {
    const cacheKey = `zipcode:${zipcode}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    // Try Nominatim first (most comprehensive coverage)
    try {
      const data = await this.getNominatimZipcode(zipcode);
      if (data) {
        const result = { ...data, source: 'nominatim' };
        this.setCache(cacheKey, result);
        return result;
      }
    } catch (error) {
      console.warn(`Nominatim API failed for ${zipcode}, trying Google Maps...`);
    }

    // Try Google Maps as second fallback (high quality data)
    if (this.googleMapsConfig.enabled) {
      try {
        const data = await this.getGoogleMapsZipcode(zipcode);
        if (data) {
          const result = { ...data, source: 'googlemaps' };
          this.setCache(cacheKey, result);
          return result;
        }
      } catch (error) {
        console.warn(`Google Maps API failed for ${zipcode}, trying Zippopotam.us...`);
      }
    }

    // Fallback to Zippopotam.us
    try {
      const response = await axios.get(`https://api.zippopotam.us/us/${zipcode}`, {
        timeout: this.baseTimeout
      });

      const data = this.transformZippopotamData(response.data);
      const result = { ...data, source: 'zippopotam' };
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error(`All APIs failed for zipcode ${zipcode}:`, error.message);
    }

    return null;
  }

  /**
   * Get zipcode data from Nominatim API
   * @param {string} zipcode - Zipcode to lookup
   * @returns {Promise<Object|null>} Zipcode data
   */
  async getNominatimZipcode(zipcode) {
    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: zipcode,
          countrycodes: 'us',
          format: 'json',
          addressdetails: 1,
          limit: 1
        },
        headers: {
          'User-Agent': 'zipcode-lookup-cli/1.0.0'
        },
        timeout: this.baseTimeout
      });

      if (response.data && response.data.length > 0) {
        return this.transformNominatimData(response.data[0], zipcode);
      }

      return null;
    } catch (error) {
      console.error(`Nominatim API error for zipcode ${zipcode}:`, error.message);
      return null;
    }
  }

  /**
   * Reverse geocode coordinates to find zipcode using Nominatim API
   * @param {number} lat - Latitude coordinate
   * @param {number} lon - Longitude coordinate
   * @returns {Promise<Object|null>} Zipcode data
   */
  async reverseGeocode(lat, lon) {
    const cacheKey = `reverse:${lat},${lon}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    // Try Nominatim first
    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
        params: {
          lat: lat,
          lon: lon,
          format: 'json',
          addressdetails: 1,
          zoom: 18
        },
        headers: {
          'User-Agent': 'zipcode-lookup-cli/1.0.0'
        },
        timeout: this.baseTimeout
      });

      if (response.data && response.data.address && response.data.address.postcode) {
        const result = this.transformNominatimData(response.data, response.data.address.postcode);
        result.source = 'nominatim';
        this.setCache(cacheKey, result);
        return result;
      }
    } catch (error) {
      console.warn(`Nominatim reverse geocoding failed for ${lat},${lon}, trying Google Maps...`);
    }

    // Try Google Maps as fallback
    if (this.googleMapsConfig.enabled) {
      try {
        const result = await this.reverseGeocodeGoogleMaps(lat, lon);
        if (result) {
          result.source = 'googlemaps';
          this.setCache(cacheKey, result);
          return result;
        }
      } catch (error) {
        console.warn(`Google Maps reverse geocoding failed for ${lat},${lon}:`, error.message);
      }
    }

    return null;
  }

  /**
   * Reverse geocode coordinates using Google Maps API
   * @param {number} lat - Latitude coordinate
   * @param {number} lon - Longitude coordinate
   * @returns {Promise<Object|null>} Zipcode data
   */
  async reverseGeocodeGoogleMaps(lat, lon) {
    if (!this.googleMapsConfig.enabled || !this.googleMapsConfig.apiKey) {
      return null;
    }

    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          latlng: `${lat},${lon}`,
          key: this.googleMapsConfig.apiKey,
          result_type: 'postal_code'
        },
        timeout: this.googleMapsConfig.timeout
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        // Find the best result with postal code
        const bestResult = response.data.results.find(result =>
          result.types.includes('postal_code')
        ) || response.data.results[0];

        const zipcode = this.extractZipcodeFromGoogleMapsResult(bestResult);
        if (zipcode) {
          return this.transformGoogleMapsData(bestResult, zipcode);
        }
      }

      return null;
    } catch (error) {
      console.error(`Google Maps reverse geocoding error for ${lat},${lon}:`, error.message);
      return null;
    }
  }

  /**
   * Search locations using Nominatim API
   * @param {Object} query - Search parameters (city, state, county)
   * @returns {Promise<Array>} Location results
   */
  async searchLocations(query) {
    const cacheKey = `location:${JSON.stringify(query)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      let searchQuery = '';

      if (query.city) {
        searchQuery += `${query.city}, `;
      }
      if (query.county) {
        searchQuery += `${query.county}, `;
      }
      if (query.state) {
        searchQuery += `${query.state}, `;
      }
      searchQuery += 'USA';

      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: searchQuery,
          countrycodes: 'us',
          format: 'json',
          addressdetails: 1,
          limit: 50
        },
        headers: {
          'User-Agent': 'zipcode-lookup-cli/1.0.0'
        },
        timeout: this.baseTimeout
      });

      const results = response.data
        .filter(result => result.address && result.address.postcode)
        .map(result => this.transformNominatimData(result, result.address.postcode));

      this.setCache(cacheKey, results);
      return results;
    } catch (error) {
      console.error(`Nominatim location search error:`, error.message);
      return [];
    }
  }

  /**
   * Search city using Google Maps API
   * @param {string} city - City name
   * @param {string} state - State abbreviation
   * @returns {Promise<Array>} Location results
   */
  async searchGoogleMapsCity(city, state) {
    if (!this.googleMapsConfig.enabled || !this.googleMapsConfig.apiKey) {
      return [];
    }

    const cacheKey = `googlemaps_city:${city},${state}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (process.env.DEBUG) {
      console.log(`🔍 Google Maps city search for "${city}, ${state}"`);
    }

    try {
      // Google Maps Geocoding API doesn't enumerate postal codes within a city well,
      // so we'll use a hybrid approach: get potential zipcodes from the offline package
      // and then enrich each one with Google Maps data
      const zipcodes = require('zipcodes');
      const offlineResults = zipcodes.lookupByName(city, state);

      if (process.env.DEBUG) {
        console.log(`🔍 Found ${offlineResults?.length || 0} potential zipcodes from offline data`);
      }

      const results = [];

      if (offlineResults && offlineResults.length > 0) {
        // For each zipcode found in the offline data, get the Google Maps data
        for (const zipResult of offlineResults) {
          try {
            if (process.env.DEBUG) {
              console.log(`🔍 Getting Google Maps data for zipcode ${zipResult.zip}`);
            }

            const googleMapsData = await this.getGoogleMapsZipcode(zipResult.zip);
            if (googleMapsData) {
              results.push(googleMapsData);
            }
          } catch (error) {
            if (process.env.DEBUG) {
              console.log(`⚠️ Failed to get Google Maps data for ${zipResult.zip}: ${error.message}`);
            }
            // Continue with other zipcodes
          }
        }
      } else {
        // Fallback: try to search directly for the city and extract any postal codes
        const searchQuery = `${city}, ${state}, USA`;
        const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
          params: {
            address: searchQuery,
            components: 'country:US',
            key: this.googleMapsConfig.apiKey
          },
          timeout: this.googleMapsConfig.timeout
        });

        if (response.data.status === 'OK' && response.data.results.length > 0) {
          for (const result of response.data.results) {
            const zipcode = this.extractZipcodeFromGoogleMapsResult(result);
            if (zipcode) {
              const transformed = this.transformGoogleMapsData(result, zipcode);
              if (transformed) {
                results.push(transformed);
              }
            }
          }
        }
      }

      if (process.env.DEBUG) {
        console.log(`🔍 Google Maps city search found ${results.length} postal codes for ${city}, ${state}`);
      }

      this.setCache(cacheKey, results);
      return results;
    } catch (error) {
      console.error(`Google Maps city search error for ${city}, ${state}:`, error.message);
      return [];
    }
  }

  /**
   * Search county using Google Maps API
   * @param {string} county - County name
   * @param {string} state - State abbreviation
   * @returns {Promise<Array>} Location results
   */
  async searchGoogleMapsCounty(county, state) {
    if (!this.googleMapsConfig.enabled || !this.googleMapsConfig.apiKey) {
      return [];
    }

    const cacheKey = `googlemaps_county:${county},${state}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const searchQuery = `${county} County, ${state}, USA`;
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address: searchQuery,
          components: 'country:US',
          key: this.googleMapsConfig.apiKey
        },
        timeout: this.googleMapsConfig.timeout
      });

      const results = [];
      if (response.data.status === 'OK' && response.data.results.length > 0) {
        for (const result of response.data.results) {
          const zipcode = this.extractZipcodeFromGoogleMapsResult(result);
          if (zipcode) {
            const transformed = this.transformGoogleMapsData(result, zipcode);
            if (transformed) {
              results.push(transformed);
            }
          }
        }
      }

      this.setCache(cacheKey, results);
      return results;
    } catch (error) {
      console.error(`Google Maps county search error for ${county}, ${state}:`, error.message);
      return [];
    }
  }

  /**
   * Search city using Nominatim API
   * @param {string} city - City name
   * @param {string} state - State abbreviation
   * @returns {Promise<Array>} Location results
   */
  async searchNominatimCity(city, state) {
    return await this.searchLocations({ city, state });
  }

  /**
   * Search county using Nominatim API
   * @param {string} county - County name
   * @param {string} state - State abbreviation
   * @returns {Promise<Array>} Location results
   */
  async searchNominatimCounty(county, state) {
    return await this.searchLocations({ county, state });
  }

  /**
   * Get single census tract data from coordinates
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {Promise<Object|null>} Census tract data
   */
  async getCensusTract(latitude, longitude) {
    const cacheKey = `census_coord:${latitude},${longitude}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      // Census Bureau API for tract data
      const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates`;
      const response = await axios.get(url, {
        params: {
          x: longitude,
          y: latitude,
          benchmark: 'Public_AR_Current',
          vintage: 'Current_Current',
          format: 'json'
        },
        timeout: this.baseTimeout
      });

      const tract = this.transformSingleCensusData(response.data);
      this.setCache(cacheKey, tract);
      return tract;
    } catch (error) {
      console.error(`Census API error for coordinates ${latitude},${longitude}:`, error.message);
      return null;
    }
  }

  /**
   * Get census tract data from Census Bureau API
   * @param {string} zipcode - Zipcode to lookup
   * @returns {Promise<Array>} Census tract data
   */
  async getCensusTracts(zipcode) {
    const cacheKey = `census:${zipcode}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const zipData = await this.getZipcode(zipcode);
      if (!zipData) return [];

      // Census Bureau API for tract data
      const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates`;
      const response = await axios.get(url, {
        params: {
          x: zipData.longitude,
          y: zipData.latitude,
          benchmark: 'Public_AR_Current',
          vintage: 'Current_Current',
          format: 'json'
        },
        timeout: this.baseTimeout
      });

      const tracts = this.transformCensusData(response.data, zipcode);
      this.setCache(cacheKey, tracts);
      return tracts;
    } catch (error) {
      console.error(`Census API error for zipcode ${zipcode}:`, error.message);
      return [];
    }
  }

  /**
   * Transform Zippopotam.us API data to our format
   * @param {Object} data - Raw API data
   * @returns {Object} Transformed data
   */
  transformZippopotamData(data) {
    const place = data.places[0];
    return {
      zipcode: data['post code'],
      latitude: parseFloat(place.latitude),
      longitude: parseFloat(place.longitude),
      city: place['place name'],
      state: place['state abbreviation'],
      county: place.state,
      timezone: null,
      area_code: null,
      population: null,
      land_area: null,
      water_area: null,
      housing_units: null,
      median_income: null,
      median_age: null
    };
  }

  /**
   * Transform Nominatim API data to our format
   * @param {Object} data - Raw Nominatim data
   * @param {string} zipcode - Zipcode for this result
   * @returns {Object} Transformed data
   */
  transformNominatimData(data, zipcode) {
    const address = data.address || {};

    return {
      zipcode: zipcode || address.postcode,
      latitude: parseFloat(data.lat),
      longitude: parseFloat(data.lon),
      city: address.city || address.town || address.village || address.hamlet || '',
      state: this.getStateAbbreviation(address.state) || address.state || '',
      county: address.county || '',
      timezone: null,
      area_code: null,
      population: null,
      land_area: null,
      water_area: null,
      housing_units: null,
      median_income: null,
      median_age: null
    };
  }

  /**
   * Transform Google Maps API data to our format
   * @param {Object} data - Raw Google Maps API data
   * @param {string} zipcode - Zipcode for this result
   * @returns {Object} Transformed data
   */
  transformGoogleMapsData(data, zipcode) {
    if (!data || !data.geometry || !data.geometry.location) {
      console.warn('Google Maps data missing geometry information:', data);
      return null;
    }

    const components = this.parseGoogleMapsComponents(data.address_components || []);

    // Validate that we have at least coordinates
    const lat = parseFloat(data.geometry.location.lat);
    const lng = parseFloat(data.geometry.location.lng);

    if (isNaN(lat) || isNaN(lng)) {
      console.warn('Google Maps data has invalid coordinates:', data.geometry.location);
      return null;
    }

    return {
      zipcode: zipcode || components.postal_code || '',
      latitude: lat,
      longitude: lng,
      city: components.locality || components.sublocality || '',
      state: components.administrative_area_level_1_short || '',
      county: components.administrative_area_level_2 || '',
      timezone: null,
      area_code: null,
      population: null,
      land_area: null,
      water_area: null,
      housing_units: null,
      median_income: null,
      median_age: null
    };
  }  /**
   * Parse Google Maps address components into a usable object
   * @param {Array} components - Google Maps address components array
   * @returns {Object} Parsed components object
   */
  parseGoogleMapsComponents(components) {
    const parsed = {};

    for (const component of components) {
      const types = component.types;
      const longName = component.long_name;
      const shortName = component.short_name;

      if (types.includes('postal_code')) {
        parsed.postal_code = longName;
      }
      if (types.includes('locality')) {
        parsed.locality = longName;
      }
      if (types.includes('sublocality')) {
        parsed.sublocality = longName;
      }
      if (types.includes('administrative_area_level_1')) {
        parsed.administrative_area_level_1 = longName;
        parsed.administrative_area_level_1_short = shortName;
      }
      if (types.includes('administrative_area_level_2')) {
        parsed.administrative_area_level_2 = longName;
      }
      if (types.includes('country')) {
        parsed.country = longName;
        parsed.country_short = shortName;
      }
    }

    return parsed;
  }

  /**
   * Extract zipcode from Google Maps geocoding result
   * @param {Object} result - Google Maps result object
   * @returns {string|null} Extracted zipcode or null
   */
  extractZipcodeFromGoogleMapsResult(result) {
    if (!result.address_components) return null;

    const postalComponent = result.address_components.find(component =>
      component.types.includes('postal_code')
    );

    return postalComponent ? postalComponent.long_name : null;
  }

  /**
   * Transform single Census Bureau API response for tract lookup
   * @param {Object} data - Raw Census API data
   * @returns {Object|null} Transformed single census tract data
   */
  transformSingleCensusData(data) {
    if (!data.result || !data.result.geographies) {
      return null;
    }

    const geographies = data.result.geographies;

    if (geographies['Census Tracts'] && geographies['Census Tracts'].length > 0) {
      const tract = geographies['Census Tracts'][0];
      const counties = geographies['Counties'] || [];
      const states = geographies['States'] || [];

      return {
        tract: tract.TRACT || '',
        block: tract.BLOCK || '',
        state_fips: tract.STATE || '',
        county_fips: tract.COUNTY || '',
        county_name: counties.length > 0 ? counties[0].NAME : '',
        state_name: states.length > 0 ? states[0].NAME : ''
      };
    }

    return null;
  }

  /**
   * Transform Census Bureau API data
   * @param {Object} data - Raw Census API data
   * @param {string} zipcode - Associated zipcode
   * @returns {Array} Transformed census tract data
   */
  transformCensusData(data, zipcode) {
    if (!data.result || !data.result.geographies) {
      return [];
    }

    const tracts = [];
    const geographies = data.result.geographies;

    if (geographies['Census Tracts']) {
      geographies['Census Tracts'].forEach(tract => {
        tracts.push({
          zipcode: zipcode,
          tract_id: tract.TRACT,
          state_fips: tract.STATE,
          county_fips: tract.COUNTY,
          tract_fips: tract.TRACT,
          block_group: null,
          population: null,
          households: null,
          median_income: null,
          geometry_wkt: null
        });
      });
    }

    return tracts;
  }

  /**
   * Convert full state names to abbreviations
   * @param {string} stateName - Full state name
   * @returns {string} State abbreviation
   */
  getStateAbbreviation(stateName) {
    const stateMap = {
      'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
      'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
      'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
      'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
      'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
      'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
      'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
      'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
      'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
      'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
    };

    return stateMap[stateName] || stateName;
  }

  /**
   * Cache management
   */
  getFromCache(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data: data,
      expiry: Date.now() + this.cacheTTL
    });
  }

  clearCache() {
    this.cache.clear();
  }
}

module.exports = APIClient;
