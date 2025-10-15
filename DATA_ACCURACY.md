# 📍 Understanding Zipcode Data Accuracy and Source Discrepancies

This document explains why different zipcode data sources provide varying coordinates, city names, and geographic boundaries. Understanding these differences is crucial for making informed decisions about which data source to use for your specific use case.

## 🎯 Key Concepts

**ZIP codes are postal delivery zones, not geographic areas.** Each data provider must approximate coordinates and boundaries using their own interpretation, leading to natural discrepancies between sources.

---

## 🏛️ Why City Names Differ Between Sources

This discrepancy arises from how ZIP codes, postal cities, and map labelers (like Google) each define "place names," which are not equivalent concepts.

### 1. ZIP Codes Are Postal Delivery Zones, Not City Boundaries

- The U.S. Postal Service (USPS) creates ZIP codes for mail routing, not for municipal or geographic accuracy
- Each ZIP code has a "default place name" (called the USPS preferred city name), but that name is purely for postal addressing and can differ from the actual city or jurisdiction on a map

**Example:**
ZIP 92054 covers most of Oceanside, CA, but USPS associates part of it with Camp Pendleton North for routing efficiency — even though it's geographically within Oceanside's municipal limits.

### 2. Google Maps Uses Mixed Data Sources

- Google combines USPS postal data, Census Bureau boundaries (ZCTAs), and local GIS datasets (county/city shapefiles, user reports, etc.)
- When data overlaps, their algorithm must "decide" which place name to display — often defaulting to the USPS preferred name for that ZIP code, even if it doesn't match local reality

### 3. Military and Federal Installations Often Distort ZIP Associations

- Large installations (like Camp Pendleton) often have dedicated ZIP codes or share ZIPs with nearby cities
- USPS may list "Camp Pendleton North" as the primary place name for one or more ZIPs that also cover civilian areas of Oceanside — causing Google to inherit the wrong name

### 4. Census vs. USPS Boundary Mismatch

- The Census Bureau (ZCTA) defines ZIP-like polygons based on where people live, while USPS defines them by mail routes
- Camp Pendleton's base housing or PO Boxes can distort the ZCTA centroid — leading Google's label placement algorithm to favor the wrong label for the entire ZIP region

### 5. Local Government and Community Names Are Not Always in USPS Data

- USPS does not maintain official city boundaries or local neighborhood names
- Google's "city" label for a ZIP is therefore not a legal or municipal definition, but a machine-learned synthesis of multiple sources — sometimes incorrect

---

## 📍 Why Centroid Coordinates Differ Between Providers

ZIP code centroid coordinates differ by provider because ZIP codes are not true geographic areas, but postal delivery zones defined by the U.S. Postal Service (USPS). Each data provider must approximate a "center point" using their own interpretation.

### 1. Different Underlying Datasets

- **USPS** defines ZIP codes as delivery routes, not polygons
- **Providers** like Census Bureau (ZCTAs), TIGER/Line, Melissa, SmartyStreets, or Google Maps each derive their own polygon approximations from ZIP boundaries
- **ZCTAs** (ZIP Code Tabulation Areas) from the U.S. Census are common, but not always up to date or perfectly aligned with USPS ZIPs

### 2. Varying Polygon Definitions

- Some sources use centroids of delivery route polygons
- Others use centroids of all address points or population-weighted centroids
- Some use centroids of bounding boxes, which can skew results for irregularly shaped ZIPs (especially rural ones)

### 3. Updates and Version Differences

- USPS frequently creates, deletes, or renames ZIP codes
- Providers update on different schedules (monthly, quarterly, annually), leading to outdated or mismatched centroids

### 4. Coordinate Calculation Method

| Method | Description | Impact |
|--------|-------------|---------|
| **Geometric centroid** | Geometric center of a polygon | Standard mathematical center |
| **Population-weighted centroid** | Center based on population distribution | Skews toward populated areas |
| **Address-weighted centroid** | Average of all known addresses in the ZIP | Reflects actual delivery density |

Each yields a different coordinate, sometimes miles apart.

### 5. Projection and Datum Differences

- Some datasets use NAD83, others WGS84, or apply local projection transformations differently
- This introduces small but measurable differences (tens to hundreds of meters)

### 6. ZIP+4 and PO Box Distortions

- **Urban ZIPs** may include PO Box-only zones without physical land area
- **Rural ZIPs** may cover huge geographic regions with very few delivery points — centroids may land far from where most residents actually live

---

## ✅ How to Verify the Correct Association

If you want to validate the correct civic city for a ZIP:

| Source | Type | Data Authority | Reliability |
|--------|------|----------------|-------------|
| **USPS.com/lookup** | Postal city name (for mailing) | USPS | ✅ Authoritative for mail |
| **Census Bureau TIGER/Line + ZCTA** | Population-based | U.S. Census | ✅ Authoritative for demographics |
| **Local GIS (County Assessor)** | Jurisdictional boundaries | County/City | ✅ Authoritative for legal boundaries |
| **Google Maps** | Aggregated heuristic | Non-authoritative | ⚠️ Machine-learned synthesis |

### For ZIP 92054 Example:

- **USPS** lists Oceanside as the primary city
- **Camp Pendleton North** is an acceptable alternate name (not preferred)
- **Google** simply surfaces the alternate label due to data blending, not because it's accurate

---

## 🔍 Practical Implications for Users

### When to Use Each Data Source

| Use Case | Recommended Source | Reason |
|----------|-------------------|---------|
| **Mail/Shipping** | USPS (`zipcodes` package) | Official postal addresses |
| **Demographics/Census** | Census ZCTAs | Population-based boundaries |
| **Geocoding/Mapping** | Google Maps API | Comprehensive address coverage |
| **Legal/Property** | Local GIS/County Assessor | Official jurisdictional boundaries |

### Understanding Distance Impact

Coordinate differences between sources can significantly affect radius searches:

- **92054 Example**: ~1 mile difference between sources
- **Impact**: Different zipcodes may be included/excluded from radius searches
- **Solution**: Use comparison mode (`--compare`) to analyze differences


---

## 🛠️ Using This Tool for Data Quality Analysis

This zipcode lookup tool is specifically designed to help you understand and analyze these discrepancies:

### Comparison Features

```bash
# Compare coordinate differences between sources
zipcode-lookup radius --zip 92054 --miles 5 --source zipcodes --compare googlemaps --include-distance

# Visualize differences with KML output
zipcode-lookup radius --zip 92054 --miles 5 --source zipcodes --compare nominatim --kml
```

### Understanding Output

The comparison mode shows:
- **Center point coordinate differences** between sources
- **Distance calculations** from each source for every zipcode
- **Full latitude/longitude coordinates** from both sources
- **Data availability indicators** (which zipcodes exist in each source)
- **Distance calculation differences** highlighting coordinate impacts



## 📊 Summary

**In short:**

- **City Name Discrepancies**: Google Maps labels ZIP codes based on a mix of USPS and geographic data. When multiple "valid" names exist for a ZIP (like 92054), Google sometimes chooses the postal or alternate name, even if the municipal reality is different. This is a limitation of automated label inference, not an actual boundary error.

- **Coordinate Discrepancies**: ZIP code centroids vary by source because there is no official geographic definition of a ZIP code. Each provider models them differently based on available data, update frequency, and the method used to compute the "center."


## 🔗 Additional Resources

- [USPS ZIP Code Lookup](https://tools.usps.com/zip-code-lookup.htm)
- [Census Bureau ZCTA Documentation](https://www.census.gov/programs-surveys/geography/guidance/geo-areas/zctas.html)
- [Google Geocoding API Documentation](https://developers.google.com/maps/documentation/geocoding)
- [Project README](README.md) - Main documentation
- [Setup Instructions](GOOGLE_API_SETUP.md) - Google Maps API configuration
