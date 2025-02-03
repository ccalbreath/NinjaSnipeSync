# Ninja RMM to Snipe-IT Asset Sync

An Azure Function that automatically synchronizes device information from Ninja RMM to Snipe-IT asset management system. This integration runs hourly to maintain an accurate inventory of your IT assets.

## Features

### Automated Asset Management
- Syncs device information from Ninja RMM to Snipe-IT
- Runs automatically every hour
- Updates existing assets only when changes are detected
- Creates new assets as devices are added to Ninja RMM

### Smart Device Categorization
Devices are automatically categorized based on their Ninja RMM nodeClass:
- Windows Servers
- Windows Workstations
- VMware Hosts
- Other Hardware

### Hardware Specifications Tracked
- Serial numbers
- Chassis type
- Virtual machine status

## Prerequisites

- Node.js 18 or later
- Azure Functions Core Tools
- Azure subscription
- Ninja RMM account with API access
- Snipe-IT installation with API access

## Installation

1. Clone the repository:

    git clone https://github.com/yourusername/ninja-snipeit-sync.git
    cd ninja-snipeit-sync

2. Install dependencies:

    npm install

3. Configure environment variables (see Configuration section)

4. Start the function locally:

    npm start

## Configuration

1. Copy `local.settings.template.json` to `local.settings.json`
2. Update the following values in `local.settings.json`:

        "NinjaBaseUrl": "https://your-ninja-instance.rmmservice.com",
        "NinjaAuthEndpoint": "/ws/oauth/token",
        "NinjaDeviceDetailEndpoint": "/v2/devices-detailed",
        "NinjaClientID": "your-client-id",
        "NinjaClientSecret": "your-client-secret",
        "SnipeBaseURL": "https://your-snipeit-instance/api/v1",
        "SnipeAPIKey": "your-snipe-it-api-key"


## Architecture

The codebase is organized into three main components:

### Azure Function (`src/functions/getDevices.js`)
- Orchestrates the sync process
- Runs on a timer trigger (hourly)
- Validates environment variables
- Initializes services

### Ninja RMM Service (`src/services/ninjaService.js`)
- Handles OAuth2 authentication
- Retrieves device information
- Filters and normalizes device data
- Processes different device types (servers, workstations, VMware hosts)

### Snipe-IT Service (`src/services/snipeService.js`)
- Manages rate limiting (1 second between requests)
- Handles manufacturer creation and caching
- Manages model creation with proper categorization
- Updates assets incrementally
- Implements bulk data loading to minimize API calls

## Error Handling

The application includes comprehensive error handling:
- Environment variable validation
- Rate limiting with automatic retries
- Detailed error logging
- Continues processing on individual device failures
- API error recovery

## Deployment

Deploy to Azure Functions using Azure CLI:

    az login
    az functionapp deployment source config-zip -g <resource-group> -n <app-name> --src <zip-file>

## Contributing

1. Fork the repository
2. Create your feature branch:

    git checkout -b feature/AmazingFeature

3. Commit your changes:

    git commit -m 'Add some AmazingFeature'

4. Push to the branch:

    git push origin feature/AmazingFeature

5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Ninja RMM API Documentation](https://eu.ninjarmm.com/apidocs/)
- [Snipe-IT API Documentation](https://snipe-it.readme.io/reference/api-overview)

## Support

For issues, questions, or contributions, please open an issue in the GitHub repository.
