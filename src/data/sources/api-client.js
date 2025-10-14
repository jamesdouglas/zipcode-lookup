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
      console.warn(`Nominatim API failed for ${zipcode}, trying Zippopotam.us...`);
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
        this.setCache(cacheKey, result);
        return result;
      }

      return null;
    } catch (error) {
      console.error(`Nominatim reverse geocoding error for ${lat},${lon}:`, error.message);
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
