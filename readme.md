
## Architecture

- `src/functions/getDevices.js` - Main Azure Function that orchestrates the sync
- `src/services/snipeService.js` - Service layer for Snipe-IT integration

## Configuration

1. Copy `local.settings.template.json` to `local.settings.json`
2. Update the following values in `local.settings.json`:
   - `NinjaBaseUrl`: Your Ninja RMM instance URL
   - `NinjaClientID`: Your Ninja RMM OAuth client ID
   - `NinjaClientSecret`: Your Ninja RMM OAuth client secret
   - `SnipeBaseURL`: Your Snipe-IT instance API URL
   - `SnipeAPIKey`: Your Snipe-IT API key

Note: `local.settings.json` is excluded from source control to protect sensitive credentials.

## Configuration Details

### Ninja RMM Configuration
- Requires API access credentials
- Uses OAuth2 client credentials flow
- Needs permissions to read device information

### Snipe-IT Configuration
- Requires API key with permissions to:
  - Create/update manufacturers
  - Create/update models
  - Create/update assets
- API key should have appropriate access level

## Error Handling

- Retries on rate limit responses
- Logs detailed error information
- Continues processing remaining devices if one fails
- Validates environment variables before starting

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Ninja RMM API Documentation](https://eu.ninjarmm.com/apidocs/)
- [Snipe-IT API Documentation](https://snipe-it.readme.io/reference/api-overview)

## Support

For issues, questions, or contributions, please open an issue in the GitHub repository.