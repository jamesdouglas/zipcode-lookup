# Google Geocoding API Integration Setup

This guide explains how to configure Google's Geocoding API as a data source for zipcode-lookup CLI.

## Getting a Google Geocoding API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Geocoding API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Geocoding API"
   - Click on it and press "Enable"
4. Create credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy your API key

## Configuration

You can configure your Google API key in two ways:

### Option 1: Environment Variable (Recommended)

```bash
export GOOGLE_API_KEY="your-api-key-here"
```

Add this to your shell profile (~/.bashrc, ~/.zshrc, etc.) to persist.

### Option 2: Configuration File

Create a `config.json` file in your project directory:

```json
{
  "googleMaps": {
    "apiKey": "your-api-key-here",
    "enabled": true
  }
}
```

Or copy the sample configuration:

```bash
cp config.sample.json config.json
# Edit config.json and add your API key
```

## Usage Examples

Once configured, you can use Google Geocoding API as a data source:

### Basic Radius Search

```bash
zipcode-lookup radius -z 90210 -m 10 --source googlemaps
```

### Location Lookup

```bash
zipcode-lookup location -z 90210 --source googlemaps
```

### Reverse Geocoding (coordinates to zipcode)

```bash
zipcode-lookup reverse --lat 34.0522 --lng -118.2437 --source googlemaps
```

### Compare Data Sources

```bash
zipcode-lookup radius -z 90210 -m 10 --compare --source googlemaps
```

## API Limits and Billing

- The Google Geocoding API has usage limits and may require billing setup
- Free tier includes a certain number of requests per month
- Monitor your usage in the Google Cloud Console
- Consider implementing caching to reduce API calls (the CLI includes automatic caching)

## API Usage and Costs

- Google Maps Geocoding API has usage limits and costs
- Check [Google's pricing page](https://developers.google.com/maps/billing-and-pricing) for current rates
- The CLI automatically caches responses to minimize API calls
- Free tier includes 40,000 requests per month (as of 2025)

## Troubleshooting

### "Google Maps API key not found"

- Verify your API key is set correctly
- Check if the environment variable is exported in your current shell

### "Google Maps API request denied"

- Verify your API key is correct
- Ensure the Geocoding API is enabled in Google Cloud Console
- Check that billing is set up if you've exceeded the free tier

### "Google Maps API quota exceeded"

- You've hit the daily/monthly limit
- Consider upgrading your plan or using other data sources as primary

## Security Best Practices

1. **Restrict your API key**: In Google Cloud Console, restrict your API key to specific APIs (Geocoding API only)
2. **Use environment variables**: Don't commit API keys to version control
3. **Monitor usage**: Set up billing alerts in Google Cloud Console

## Data Quality

Google Maps provides:

- High accuracy coordinates
- Comprehensive address components
- International coverage (not just US)
- Administrative divisions (county, state)
- Formatted addresses

Consider using Google Maps as a fallback or for comparison with the built-in zipcodes package.
