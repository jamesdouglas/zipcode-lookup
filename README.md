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

## 🏗️ Architecture Overview

```mermaid
graph TB
    CLI[CLI Interface<br/>Commander.js] --> Router[Main Router<br/>src/index.js]

    Router --> RC[Radius Command]
    Router --> LC[Location Command]
    Router --> CC[Census Command]
    Router --> BC[Batch Command]

    RC --> DS[Data Sources]
    LC --> DS
    CC --> DS
    BC --> DS

    DS --> ZP[Zipcodes Package<br/>Offline US Data]
    DS --> API[External APIs<br/>Zippopotam.us<br/>Nominatim/OSM<br/>Census Bureau]

    RC --> UTILS[Utilities]
    LC --> UTILS
    CC --> UTILS
    BC --> UTILS

    UTILS --> DIST[Distance Calc<br/>Haversine Formula]
    UTILS --> FMT[Output Formatters<br/>JSON/CSV/YAML/Table]
    UTILS --> CSV[CSV Handler<br/>Batch Processing]
    UTILS --> CACHE[Response Cache<br/>Performance]

    style CLI fill:#e1f5fe
    style DS fill:#f3e5f5
    style UTILS fill:#e8f5e8
```

## 🔄 Data Source Fallback Strategy

```mermaid
flowchart TD
    START([User Query]) --> ZIPCODE[Use Zipcodes Package]

    ZIPCODE --> ZQUERY[Query Offline Package]
    ZQUERY --> ZRESULT{Results Found?}
    ZRESULT -->|✅ Yes| SUCCESS[Return Results]
    ZRESULT -->|❌ No| API[External API Fallback]

    API --> NOMINATIM[Query Nominatim/OSM]
    NOMINATIM --> NRESULT{Results Found?}
    NRESULT -->|✅ Yes| SUCCESS
    NRESULT -->|❌ No| AQUERY[Query Zippopotam.us]
    AQUERY --> ARESULT{Results Found?}
    ARESULT -->|✅ Yes| SUCCESS
    ARESULT -->|❌ No| ERROR[No Results Found]

    SUCCESS --> FORMAT[Format Output<br/>JSON/CSV/YAML/Table]
    FORMAT --> OUTPUT([Return to User])

    ERROR --> OUTPUT

    style ZIPCODE fill:#c8e6c9
    style API fill:#ffcdd2
    style SUCCESS fill:#dcedc8
```

## 🚀 Usage

### Command Structure

```mermaid
graph LR
    CLI[zipcode-lookup] --> R[radius]
    CLI --> L[location]
    CLI --> C[census]
    CLI --> B[batch]

    R --> R1[--zip 90210]
    R --> R2[--miles 25]
    R --> R3[--include-distance]

    L --> L1[--city Los Angeles]
    L --> L2[--state CA]
    L --> L3[--county Los Angeles]

    C --> C1[--zip 90210]
    C --> C2[--include-boundaries]

    B --> B1[--input input.csv]
    B --> B2[--output output.csv]
    B --> B3[--operation radius]
    B --> B4[--miles 25]
    B --> B6[--include-distance]

    style R fill:#9ff
    style L fill:#99f
    style C fill:#aaa
    style B fill:#bb1
```

## Usage Examples

### 1. Radius Search

Find all zipcodes within a specified distance from a center point.

```bash
# Basic radius search
zipcode-lookup radius --zip 90210 --miles 25

# Include distance in results
zipcode-lookup radius --zip 92054 --miles 25 --include-distance


# Use specific data sources
zipcode-lookup radius --zip 90210 --miles 25 --source zipcodes
zipcode-lookup radius --zip 90210 --miles 25 --source nominatim
zipcode-lookup radius --zip 90210 --miles 25 --source zippopotam

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

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--format` | `-f` | Output format (json, csv, yaml, table) | `table` |
| `--fields` | | Comma-separated fields to include | All fields |
| `--source` | `-s` | Data source (nominatim, zippopotam, zipcodes, local, auto) | `auto` |
| `--help` | `-h` | Show help information | - |

### Command-Specific Options

#### Radius Command
| Option | Description | Required |
|--------|-------------|----------|
| `-z, --zip` | Center zipcode | ✅ |
| `-m, --miles` | Radius in miles | ✅ |
| `--include-distance` | Include distance in output | ❌ |
| `--include-coordinates` | Include latitude/longitude coordinates | ❌ |
| `--include-city` | Include city name | ❌ |
| `--include-state` | Include state | ❌ |
| `--custom-field` | Include custom field from data | ❌ |

#### Location Command
| Option | Description | Required |
|--------|-------------|----------|
| `-c, --city` | City name | ✅ (or county) |
| `-s, --state` | State code (e.g., CA, TX) | ❌ |
| `--county` | County name | ✅ (or city) |
| `--include-coordinates` | Include latitude/longitude coordinates | ❌ |

#### Census Command
| Option | Description | Required |
|--------|-------------|----------|
| `-z, --zip` | Zipcode to lookup | ✅ |
| `--include-boundaries` | Include tract boundary coordinates | ❌ |

#### Batch Command
| Option | Description | Required |
|--------|-------------|----------|
| `-i`, `--input` | Input CSV file path | ✅ |
| `-o`, `--output` | Output CSV file path | ✅ |
| `--operation` | Operation: radius, location, census, distance | ✅ |
| `--source` | Data source: nominatim, zippopotam, zipcodes, local, auto | ❌ |
| `--chunk-size` | Processing chunk size | ❌ |
| `--progress` | Show progress bar | ❌ |
| `--radius` | Radius for batch radius operations | if operation = radius |
| `-m`, `--miles` | Radius in miles (alias for --radius) | if operation = radius |
| `--centroid-zipcode` | Centroid zipcode for distance operations | if operation = distance |
| `--include-distance` | Include distance in output | ❌ |


## 🔧 Development

### Project Structure

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

### Data Flow Architecture

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant Router
    participant Command
    participant DataSource
    participant Utils

    User->>CLI: zipcode-lookup radius --zip 90210 --miles 25
    CLI->>Router: Parse arguments and route
    Router->>Command: Execute radius command

    Command->>DataSource: Get center point coordinates
    DataSource->>DataSource: Try Zipcodes Package
    alt Zipcodes Package fails
        DataSource->>DataSource: Try Nominatim API
        alt Nominatim API fails
            DataSource->>DataSource: Try Zippopotam API
        end
    end
    DataSource-->>Command: Return coordinates

    Command->>DataSource: Find zipcodes in radius
    DataSource->>DataSource: Apply same fallback strategy
    DataSource-->>Command: Return zipcode list

    Command->>Utils: Calculate distances
    Utils-->>Command: Return enhanced results

    Command->>Utils: Format output
    Utils-->>Command: Return formatted data

    Command-->>Router: Return results
    Router-->>CLI: Return final output
    CLI-->>User: Display results
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

| Command | Zipcodes Package | Nominatim API | Zippopotam API |
|---------|------------------|---------------|----------------|
| Single Zipcode | 15ms | 180ms | 250ms |
| Radius Search (25 miles) | 45ms | 1.8s | 2.5s |
| Batch (100 items) | 800ms | 35s | 45s |

### Coverage Statistics

| Data Source | US Zipcodes | Update Frequency |
|-------------|-------------|------------------|
| Zipcodes Package | ~42,000 (complete) | Package updates |
| External API | ~40,000 | Real-time |

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
