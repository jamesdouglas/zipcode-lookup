/**
 * Distance calculation utilities using the Haversine formula
 */

/**
 * Calculate the distance between two points using the Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in miles
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Convert degrees to radians
 * @param {number} degrees
 * @returns {number} Radians
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Find all zipcodes within a given radius
 * @param {Object} baseZipcode - Base zipcode object with lat/lon
 * @param {Array} allZipcodes - Array of all zipcode objects
 * @param {number} radiusMiles - Radius in miles
 * @returns {Array} Array of zipcodes within radius with distances
 */
function findZipcodesInRadius(baseZipcode, allZipcodes, radiusMiles) {
  const results = [];

  for (const zipcode of allZipcodes) {
    if (zipcode.zipcode === baseZipcode.zipcode) {
      continue; // Skip the base zipcode itself
    }

    const distance = calculateDistance(
      baseZipcode.latitude,
      baseZipcode.longitude,
      zipcode.latitude,
      zipcode.longitude
    );

    if (distance <= radiusMiles) {
      results.push({
        ...zipcode,
        distance: Math.round(distance * 100) / 100 // Round to 2 decimal places
      });
    }
  }

  // Sort by distance
  return results.sort((a, b) => a.distance - b.distance);
}

/**
 * Calculate bounding box for efficient database queries
 * @param {number} lat - Center latitude
 * @param {number} lon - Center longitude
 * @param {number} radiusMiles - Radius in miles
 * @returns {Object} Bounding box coordinates
 */
function getBoundingBox(lat, lon, radiusMiles) {
  const latChange = radiusMiles / 69; // Approximate miles per degree latitude
  const lonChange = radiusMiles / (69 * Math.cos(toRadians(lat))); // Adjust for longitude

  return {
    minLat: lat - latChange,
    maxLat: lat + latChange,
    minLon: lon - lonChange,
    maxLon: lon + lonChange
  };
}

module.exports = {
  calculateDistance,
  findZipcodesInRadius,
  getBoundingBox,
  toRadians
};
