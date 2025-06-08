/**
 * US State Coordinate Grid System
 * Maps lat/lon coordinates to state bounding boxes for efficient reverse lookups
 */

// US State bounding boxes (approximate min/max lat/lon)
const STATE_BOUNDING_BOXES = {
    'AL': { minLat: 30.2, maxLat: 35.0, minLon: -88.5, maxLon: -84.9 }, // Alabama
    'AK': { minLat: 54.6, maxLat: 71.4, minLon: -179.1, maxLon: -129.9 }, // Alaska
    'AZ': { minLat: 31.3, maxLat: 37.0, minLon: -114.8, maxLon: -109.0 }, // Arizona
    'AR': { minLat: 33.0, maxLat: 36.5, minLon: -94.6, maxLon: -89.6 }, // Arkansas
    'CA': { minLat: 32.5, maxLat: 42.0, minLon: -124.4, maxLon: -114.1 }, // California
    'CO': { minLat: 37.0, maxLat: 41.0, minLon: -109.1, maxLon: -102.0 }, // Colorado
    'CT': { minLat: 40.9, maxLat: 42.1, minLon: -73.7, maxLon: -71.8 }, // Connecticut
    'DE': { minLat: 38.4, maxLat: 39.8, minLon: -75.8, maxLon: -75.0 }, // Delaware
    'FL': { minLat: 24.4, maxLat: 31.0, minLon: -87.6, maxLon: -80.0 }, // Florida
    'GA': { minLat: 30.4, maxLat: 35.0, minLon: -85.6, maxLon: -80.8 }, // Georgia
    'HI': { minLat: 18.9, maxLat: 28.4, minLon: -178.3, maxLon: -154.8 }, // Hawaii
    'ID': { minLat: 42.0, maxLat: 49.0, minLon: -117.2, maxLon: -111.0 }, // Idaho
    'IL': { minLat: 36.9, maxLat: 42.5, minLon: -91.5, maxLon: -87.0 }, // Illinois
    'IN': { minLat: 37.8, maxLat: 41.8, minLon: -88.1, maxLon: -84.8 }, // Indiana
    'IA': { minLat: 40.4, maxLat: 43.5, minLon: -96.6, maxLon: -90.1 }, // Iowa
    'KS': { minLat: 37.0, maxLat: 40.0, minLon: -102.1, maxLon: -94.6 }, // Kansas
    'KY': { minLat: 36.5, maxLat: 39.1, minLon: -89.6, maxLon: -81.9 }, // Kentucky
    'LA': { minLat: 28.9, maxLat: 33.0, minLon: -94.0, maxLon: -88.8 }, // Louisiana
    'ME': { minLat: 43.1, maxLat: 47.5, minLon: -71.1, maxLon: -66.9 }, // Maine
    'MD': { minLat: 37.9, maxLat: 39.7, minLon: -79.5, maxLon: -75.0 }, // Maryland
    'MA': { minLat: 41.2, maxLat: 42.9, minLon: -73.5, maxLon: -69.9 }, // Massachusetts
    'MI': { minLat: 41.7, maxLat: 48.2, minLon: -90.4, maxLon: -82.4 }, // Michigan
    'MN': { minLat: 43.5, maxLat: 49.4, minLon: -97.2, maxLon: -89.5 }, // Minnesota
    'MS': { minLat: 30.2, maxLat: 35.0, minLon: -91.7, maxLon: -88.1 }, // Mississippi
    'MO': { minLat: 36.0, maxLat: 40.6, minLon: -95.8, maxLon: -89.1 }, // Missouri
    'MT': { minLat: 45.0, maxLat: 49.0, minLon: -116.0, maxLon: -104.0 }, // Montana
    'NE': { minLat: 40.0, maxLat: 43.0, minLon: -104.1, maxLon: -95.3 }, // Nebraska
    'NV': { minLat: 35.0, maxLat: 42.0, minLon: -120.0, maxLon: -114.0 }, // Nevada
    'NH': { minLat: 42.7, maxLat: 45.3, minLon: -72.6, maxLon: -70.6 }, // New Hampshire
    'NJ': { minLat: 38.9, maxLat: 41.4, minLon: -75.6, maxLon: -73.9 }, // New Jersey
    'NM': { minLat: 31.3, maxLat: 37.0, minLon: -109.1, maxLon: -103.0 }, // New Mexico
    'NY': { minLat: 40.5, maxLat: 45.0, minLon: -79.8, maxLon: -71.9 }, // New York
    'NC': { minLat: 33.8, maxLat: 36.6, minLon: -84.3, maxLon: -75.5 }, // North Carolina
    'ND': { minLat: 45.9, maxLat: 49.0, minLon: -104.1, maxLon: -96.6 }, // North Dakota
    'OH': { minLat: 38.4, maxLat: 42.0, minLon: -84.8, maxLon: -80.5 }, // Ohio
    'OK': { minLat: 33.6, maxLat: 37.0, minLon: -103.0, maxLon: -94.4 }, // Oklahoma
    'OR': { minLat: 42.0, maxLat: 46.3, minLon: -124.6, maxLon: -116.5 }, // Oregon
    'PA': { minLat: 39.7, maxLat: 42.5, minLon: -80.5, maxLon: -74.7 }, // Pennsylvania
    'RI': { minLat: 41.1, maxLat: 42.0, minLon: -71.9, maxLon: -71.1 }, // Rhode Island
    'SC': { minLat: 32.0, maxLat: 35.2, minLon: -83.4, maxLon: -78.5 }, // South Carolina
    'SD': { minLat: 42.5, maxLat: 45.9, minLon: -104.1, maxLon: -96.4 }, // South Dakota
    'TN': { minLat: 35.0, maxLat: 36.7, minLon: -90.3, maxLon: -81.6 }, // Tennessee
    'TX': { minLat: 25.8, maxLat: 36.5, minLon: -106.6, maxLon: -93.5 }, // Texas
    'UT': { minLat: 37.0, maxLat: 42.0, minLon: -114.1, maxLon: -109.0 }, // Utah
    'VT': { minLat: 42.7, maxLat: 45.0, minLon: -73.4, maxLon: -71.5 }, // Vermont
    'VA': { minLat: 36.5, maxLat: 39.5, minLon: -83.7, maxLon: -75.2 }, // Virginia
    'WA': { minLat: 45.5, maxLat: 49.0, minLon: -124.8, maxLon: -116.9 }, // Washington
    'WV': { minLat: 37.2, maxLat: 40.6, minLon: -82.6, maxLon: -77.7 }, // West Virginia
    'WI': { minLat: 42.5, maxLat: 47.1, minLon: -92.9, maxLon: -86.2 }, // Wisconsin
    'WY': { minLat: 41.0, maxLat: 45.0, minLon: -111.1, maxLon: -104.1 }, // Wyoming
};

class CoordinateGrid {
    constructor() {
        this.stateBounds = STATE_BOUNDING_BOXES;
    }

    /**
     * Find candidate states based on lat/lon coordinates
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @param {number} buffer - Buffer distance in degrees (default: 0.5 degrees ≈ 35 miles)
     * @returns {string[]} Array of state abbreviations
     */
    getCandidateStates(lat, lon, buffer = 0.5) {
        const candidates = [];

        for (const [state, bounds] of Object.entries(this.stateBounds)) {
            // Check if coordinates are within state bounds (with buffer)
            if (lat >= (bounds.minLat - buffer) &&
                lat <= (bounds.maxLat + buffer) &&
                lon >= (bounds.minLon - buffer) &&
                lon <= (bounds.maxLon + buffer)) {
                candidates.push(state);
            }
        }

        // If no candidates found (edge case), return nearby states
        if (candidates.length === 0) {
            return this.findNearestStates(lat, lon, 3);
        }

        return candidates;
    }

    /**
     * Find nearest states when coordinates don't fall within any state bounds
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @param {number} count - Number of nearest states to return
     * @returns {string[]} Array of state abbreviations
     */
    findNearestStates(lat, lon, count = 3) {
        const distances = [];

        for (const [state, bounds] of Object.entries(this.stateBounds)) {
            // Calculate distance to center of state bounding box
            const centerLat = (bounds.minLat + bounds.maxLat) / 2;
            const centerLon = (bounds.minLon + bounds.maxLon) / 2;

            const distance = this.calculateDistance(lat, lon, centerLat, centerLon);
            distances.push({ state, distance });
        }

        // Sort by distance and return top candidates
        distances.sort((a, b) => a.distance - b.distance);
        return distances.slice(0, count).map(item => item.state);
    }

    /**
     * Calculate distance between two points using Haversine formula
     * @param {number} lat1 - First point latitude
     * @param {number} lon1 - First point longitude
     * @param {number} lat2 - Second point latitude
     * @param {number} lon2 - Second point longitude
     * @returns {number} Distance in miles
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 3959; // Earth's radius in miles
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Convert degrees to radians
     * @param {number} degrees - Degrees
     * @returns {number} Radians
     */
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Get state bounding box
     * @param {string} state - State abbreviation
     * @returns {object|null} Bounding box or null if not found
     */
    getStateBounds(state) {
        return this.stateBounds[state.toUpperCase()] || null;
    }

    /**
     * Check if coordinates are within US bounds
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @returns {boolean} True if within continental US + Alaska + Hawaii
     */
    isWithinUSBounds(lat, lon) {
        // Continental US bounds
        if (lat >= 24.4 && lat <= 49.4 && lon >= -124.8 && lon <= -66.9) {
            return true;
        }

        // Alaska bounds
        if (lat >= 54.6 && lat <= 71.4 && lon >= -179.1 && lon <= -129.9) {
            return true;
        }

        // Hawaii bounds
        if (lat >= 18.9 && lat <= 28.4 && lon >= -178.3 && lon <= -154.8) {
            return true;
        }

        return false;
    }

    /**
     * Get debug information about coordinate lookup
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @returns {object} Debug information
     */
    getDebugInfo(lat, lon) {
        const candidates = this.getCandidateStates(lat, lon);
        const isWithinUS = this.isWithinUSBounds(lat, lon);
        const nearestStates = this.findNearestStates(lat, lon, 5);

        return {
            coordinates: { lat, lon },
            isWithinUS,
            candidateStates: candidates,
            candidateCount: candidates.length,
            nearestStates,
            searchOptimization: `Reduced search from 50 states to ${candidates.length} states`
        };
    }
}

module.exports = CoordinateGrid;
