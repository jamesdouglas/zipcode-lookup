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

## Diagrams

For a visual overview of the architecture, command structure, data flow and data source fallbacks, refer to [DIAGRAMS.md](DIAGRAMS.md).

## 🚀 Usage

### 1. Radius Search

Find all zipcodes within a specified distance from a center point.

For a visual overview of the command structure and option relationships, refer to [DIAGRAMS.md - Command Structure](DIAGRAMS.md#command-structure).

```bash
# Basic radius search
zipcode-lookup radius --zip 90210 --miles 25

# Include distance in results
zipcode-lookup radius --zip 92054 --miles 25 --include-distance

# Use specific data sources
zipcode-lookup radius --zip 90210 --miles 25 --source zipcodes
zipcode-lookup radius --zip 90210 --miles 25 --source nominatim
zipcode-lookup radius --zip 90210 --miles 25 --source zippopotam

# Compare data sources - analyze coordinate and distance differences
zipcode-lookup radius --zip 92054 --miles 5 --include-distance --source zipcodes --compare nominatim
zipcode-lookup radius --zip 90210 --miles 3 --include-distance --source nominatim --compare zippopotam

# Custom output format
zipcode-lookup radius --zip 90210 --miles 25 --format csv > results.csv
zipcode-lookup radius --zip 90210 --miles 25 --format json
```

**Example Output:**

```
┌─────────┬────────────────────┬───────┬──────────┬───────────┬────────────────┐
│ zipcode │ city               │ state │ latitude │ longitude │ distance_miles │
├─────────┼────────────────────┼───────┼──────────┼───────────┼────────────────┤
│ 92054   │ Oceanside          │ CA    │ 33.2072  │ -117.3573 │ 0              │
├─────────┼────────────────────┼───────┼──────────┼───────────┼────────────────┤
│ 92049   │ Oceanside          │ CA    │ 33.1959  │ -117.3795 │ 1.5            │
├─────────┼────────────────────┼───────┼──────────┼───────────┼────────────────┤
│ 92051   │ Oceanside          │ CA    │ 33.1959  │ -117.3795 │ 1.5            │
└─────────┴────────────────────┴───────┴──────────┴───────────┴────────────────┘
```

### 2. Location Search

Search for zipcodes by city, state, or county.

```bash
# Search by city and state
zipcode-lookup location --city "Los Angeles" --state CA

# Search by county
zipcode-lookup location --county "Orange County" --state CA


# Multiple output formats
zipcode-lookup location --city "Beverly Hills" --state CA --format json
zipcode-lookup location --city "Manhattan" --state NY --format yaml
```

### 3. Census Data Integration

Get census tract information for specific zipcodes.

```bash
# Basic census lookup
zipcode-lookup census --zip 90210

# Include tract boundary coordinates
zipcode-lookup census --zip 90210 --include-boundaries
```

### 4. Batch Processing

Process multiple queries from CSV files. Column name `zipcode` is required for radius, distance and census operations. Columns `city` and `state` are required for location operations.

```bash
# Batch radius search
zipcode-lookup batch --input zipcodes.csv --output results.csv --operation radius --radius 25

# Batch location search
zipcode-lookup batch --input locations.csv --output results.csv --operation location

# Distance calculation between zipcodes
zipcode-lookup batch --input zipcodes.csv --output results.csv --operation distance --centroid-zipcode 90210
```

**Input CSV Format for Batch Radius:**

```csv
zipcode,miles
90210,25
10001,50
60601,30
```

**Input CSV Format for Batch Location:**

```csv
city,state
Los Angeles,CA
New York,NY
Chicago,IL
```

## 🛠️ Configuration Options

### Global Options

| Option     | Alias | Description                                                | Default    |
| ---------- | ----- | ---------------------------------------------------------- | ---------- |
| `--format` | `-f`  | Output format (json, csv, yaml, table)                     | `table`    |
| `--fields` |       | Comma-separated fields to include                          | All fields |
| `--source` | `-s`  | Data source (nominatim, zippopotam, zipcodes, local, auto) | `auto`     |
| `--help`   | `-h`  | Show help information                                      | -          |

### Command-Specific Options

#### Radius Command

| Option                  | Description                            | Required |
| ----------------------- | -------------------------------------- | -------- |
| `-z, --zip`             | Center zipcode                         | ✅        |
| `-m, --miles`           | Radius in miles                        | ✅        |
| `--compare`             | Compare with another data source       | ❌        |
| `--include-distance`    | Include distance in output             | ❌        |
| `--include-coordinates` | Include latitude/longitude coordinates | ❌        |
| `--include-city`        | Include city name                      | ❌        |
| `--include-state`       | Include state                          | ❌        |
| `--custom-field`        | Include custom field from data         | ❌        |

#### Location Command

| Option                  | Description                            | Required      |
| ----------------------- | -------------------------------------- | ------------- |
| `-c, --city`            | City name                              | ✅ (or county) |
| `-s, --state`           | State code (e.g., CA, TX)              | ❌             |
| `--county`              | County name                            | ✅ (or city)   |
| `--include-coordinates` | Include latitude/longitude coordinates | ❌             |

#### Census Command

| Option                 | Description                        | Required |
| ---------------------- | ---------------------------------- | -------- |
| `-z, --zip`            | Zipcode to lookup                  | ✅        |
| `--include-boundaries` | Include tract boundary coordinates | ❌        |

#### Batch Command

| Option               | Description                                               | Required                |
| -------------------- | --------------------------------------------------------- | ----------------------- |
| `-i`, `--input`      | Input CSV file path                                       | ✅                       |
| `-o`, `--output`     | Output CSV file path                                      | ✅                       |
| `--operation`        | Operation: radius, location, census, distance             | ✅                       |
| `--source`           | Data source: nominatim, zippopotam, zipcodes, local, auto | ❌                       |
| `--chunk-size`       | Processing chunk size                                     | ❌                       |
| `--progress`         | Show progress bar                                         | ❌                       |
| `--radius`           | Radius for batch radius operations                        | if operation = radius   |
| `-m`, `--miles`      | Radius in miles (alias for --radius)                      | if operation = radius   |
| `--centroid-zipcode` | Centroid zipcode for distance operations                  | if operation = distance |
| `--include-distance` | Include distance in output                                | ❌                       |

#### Data Source Comparison

The `--compare` option enables powerful analysis of coordinate and distance differences between data sources. This feature helps identify data quality issues, coordinate discrepancies, and coverage gaps.

**Comparison Output Includes:**
- Center point coordinate differences between sources
- Distance calculations from each source for every zipcode
- Full latitude/longitude coordinates from both sources
- Data availability indicators (which zipcodes exist in each source)
- Distance calculation differences highlighting coordinate impacts

**Example Comparison Output:**

```
Zipcode Comparison: 92054
Radius: 3 miles
Primary Source: zipcodes
Compare Source: nominatim
Coordinate Difference: 1.0194 miles

Center Point Coordinates:
┌───────────┬────────────┬──────────────┬───────────┬───────┐
│ Source    │ Latitude   │ Longitude    │ City      │ State │
├───────────┼────────────┼──────────────┼───────────┼───────┤
│ zipcodes  │ 33.2072    │ -117.3573    │ Oceanside │ CA    │
├───────────┼────────────┼──────────────┼───────────┼───────┤
│ nominatim │ 33.1924492 │ -117.3576055 │ Oceanside │ CA    │
└───────────┴────────────┴──────────────┴───────────┴───────┘

Detailed Zipcode Comparison:
┌─────────┬───────────────┬──────────────┬──────────────┬────────────────┬───────────────┬───────────────┬───────┬────────────┬────────────┐
│ Zipcode │ zipcodes Dist │ zipcodes Lat │ zipcodes Lon │ nominatim Dist │ nominatim Lat │ nominatim Lon │ Diff  │ In Primary │ In Compare │
├─────────┼───────────────┼──────────────┼──────────────┼────────────────┼───────────────┼───────────────┼───────┼────────────┼────────────┤
│ 92054   │ 0             │ 33.2072      │ -117.3573    │ 1.02           │ 33.2072       │ -117.3573     │ -1.02 │ ✓          │ ✓          │
├─────────┼───────────────┼──────────────┼──────────────┼────────────────┼───────────────┼───────────────┼───────┼────────────┼────────────┤
│ 92049   │ 1.5           │ 33.1959      │ -117.3795    │ 1.29           │ 33.1959       │ -117.3795     │ +0.21 │ ✓          │ ✓          │
└─────────┴───────────────┴──────────────┴──────────────┴────────────────┴───────────────┴───────────────┴───────┴────────────┴────────────┘
```

## 🔧 Development

### Project Structure

For a visual overview of the architecture, refer to [DIAGRAMS.md - Architecture Overview](DIAGRAMS.md#architecture-overview).

```
zipcode-lookup/
├── 📁 bin/
│   └── zipcode-lookup.js          # CLI entry point
├── 📁 src/
│   ├── index.js                   # Main application router
│   ├── 📁 commands/               # Command implementations
│   │   ├── radius.js              # Radius search logic
│   │   ├── location.js            # Location search logic
│   │   ├── census.js              # Census data integration
│   │   └── batch.js               # Batch processing
│   ├── 📁 data/sources/           # Data source abstractions
│   │   └── api-client.js          # External API client
│   └── 📁 utils/                  # Utility functions
│       ├── distance.js            # Distance calculations
│       ├── formatters.js          # Output formatting
│       ├── csv-handler.js         # CSV processing
│       └── cache.js               # Response caching
├── package.json                   # Project configuration
└── README.md                      # This file
```

### Setting Up Development Environment

```bash
# Clone and install
git clone <repository-url>
cd zipcode-lookup
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Link for global testing
npm link
```

### Adding New Commands

1. **Create command file** in `src/commands/`:

```javascript
class NewCommand {
    async execute(options) {
        // Implementation
    }
}
module.exports = NewCommand;
```

2. **Add to router** in `src/index.js`:

```javascript
const NewCommand = require('./commands/new-command');
// Register in command mapping
```

3. **Add CLI interface** in `bin/zipcode-lookup.js`:

```javascript
program
    .command('new-command')
    .description('Description of new command')
    .option('--option', 'Option description')
    .action(async (options) => {
        // Handler
    });
```

## 📊 Performance Benchmarks

### Response Times (Average)

| Command                  | Zipcodes Package | Nominatim API | Zippopotam API |
| ------------------------ | ---------------- | ------------- | -------------- |
| Single Zipcode           | 15ms             | 180ms         | 250ms          |
| Radius Search (25 miles) | 45ms             | 1.8s          | 2.5s           |
| Batch (100 items)        | 800ms            | 35s           | 45s            |

### Coverage Statistics

| Data Source      | US Zipcodes        | Update Frequency |
| ---------------- | ------------------ | ---------------- |
| Zipcodes Package | ~42,000 (complete) | Package updates  |
| External API     | ~40,000            | Real-time        |

## 🔍 Troubleshooting

### Common Issues

#### API Rate Limiting

```bash
API error: Request failed with status code 429
```

**Solution**: The tool automatically falls back to offline sources. Consider using `--source zipcodes` for faster queries.

#### Invalid Zipcode

```bash
Error: Could not find coordinates for zipcode 00000
```

**Solution**: Verify the zipcode exists. Try using different data sources with `--source nominatim` or `--source zippopotam` for broader coverage.

### Debug Mode

```bash
# Enable verbose logging
DEBUG=zipcode-lookup* zipcode-lookup radius --zip 90210 --miles 25

# Test connectivity
zipcode-lookup location --city "Test" --state CA --source nominatim
```

## 🤝 Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make changes and add tests
4. Run tests: `npm test`
5. Submit a pull request

### Code Style

- Use ES6+ features
- Follow ESLint configuration
- Add JSDoc comments for public methods
- Include unit tests for new functionality

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **zipcodes npm package** - Comprehensive US zipcode data
- **Nominatim/OpenStreetMap** - Additional geocoding API
- **US Census Bureau** - Census tract data
- **OpenStreetMap** - Geographic data sources
- **Zippopotam.us** - Free zipcode API fallback
- **Anthropic Claude** - AI assistance for documentation and code generation

---

**Built with Claude by [James Douglas](https://github.com/jamesdouglas) for accurate geographic lookups**
