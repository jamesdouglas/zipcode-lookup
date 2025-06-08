# 🗺️ Zipcode Lookup CLI Tool

A comprehensive command-line interface for zipcode lookup, radius search, location-based queries, and census tract integration. Features intelligent data source fallbacks, multiple output formats, and accurate geographic calculations.

## ✨ Features

- **🎯 Radius Search**: Find all zipcodes within a specified distance
- **📍 Location Search**: Lookup zipcodes by city, state, or county
- **🏛️ Census Integration**: Get census tract data for zipcodes
- **📊 Batch Processing**: Process multiple queries from CSV files
- **🔄 Smart Fallbacks**: Zipcodes Package → Online API
- **📋 Multiple Formats**: JSON, CSV, YAML, and formatted tables
- **📏 Distance Calculations**: Accurate Haversine formula with sorting
- **⚡ Performance**: Fast offline lookups with comprehensive coverage

## 📦 Installation

### Prerequisites
- Node.js 18.0.0 or higher
- npm or yarn

### Quick Install
```bash
# Clone the repository
git clone https://github.com/jamesdouglas/zipcode-lookup.git

# Change directory to the project
cd zipcode-lookup

# Install dependencies
npm install

# Make globally available
npm link
```

### Dependencies
```bash
npm install axios chalk cli-table3 commander fs-extra js-yaml ora papaparse yargs zipcodes
```

## 🚀 Usage

### Basic Examples

```bash
# Find zipcodes within 25 miles of Beverly Hills
zipcode-lookup radius --zip 90210 --miles 25

# Search for zipcodes in Los Angeles
zipcode-lookup location --city "Los Angeles" --state CA

# Get census data for a zipcode
zipcode-lookup census --zip 90210

# Process multiple zipcodes from CSV
zipcode-lookup batch --input zipcodes.csv --output results.csv --operation radius --radius 25
```

## 🏗️ Architecture

Uses intelligent data source fallbacks:
1. **Zipcodes Package** (Offline, ~42K US zipcodes)
2. **Nominatim API** (OpenStreetMap geocoding)
3. **Zippopotam.us API** (Free zipcode API)

## 🛠️ Commands

- `radius` - Find zipcodes within a distance
- `location` - Search by city/state/county  
- `census` - Get census tract information
- `batch` - Process multiple queries from CSV

## 📄 License

MIT License

---

**Built with Claude by [James Douglas](https://github.com/jamesdouglas) for accurate geographic lookups**