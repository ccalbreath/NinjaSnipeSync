/**
 * @fileoverview Azure Function that syncs device information from Ninja RMM to Snipe-IT.
 * @module getDevices
 * @requires @azure/functions
 * @requires ../services/snipeService
 * @requires ../services/ninjaService
 */

const { app } = require('@azure/functions');
const SnipeService = require('../services/snipeService');
const NinjaService = require('../services/ninjaService');

/**
 * Timer triggered function to sync devices between Ninja RMM and Snipe-IT.
 * Runs every hour to fetch device information from Ninja RMM and update Snipe-IT accordingly.
 * 
 * @function getDevices
 * @param {Object} myTimer - Timer information
 * @param {Object} context - Azure Function context for logging
 * @returns {Promise<Object>} Object containing the number of devices processed
 * @throws {Error} If required environment variables are missing or API calls fail
 */
app.timer('getDevices', {
    schedule: '0 0 * * * *', // Runs at the start of every hour
    handler: async (myTimer, context) => {
        try {
            // Validate environment variables
            await validateEnvironment(context);

            // Initialize services
            const ninjaService = new NinjaService(
                process.env.NinjaBaseUrl,
                process.env.NinjaClientID,
                process.env.NinjaClientSecret
            );

            const snipeService = new SnipeService(
                process.env.SnipeBaseURL,
                process.env.SnipeAPIKey
            );
            
            // Get and process Ninja RMM devices
            const devices = await ninjaService.getDevices(context);
            const processedDevices = ninjaService.processDevices(devices, context);

            // Sync with Snipe-IT
            await snipeService.syncDevices(processedDevices, context);

            context.log(`Successfully processed ${processedDevices.length} devices and synced with Snipe-IT`);
            return { body: `Processed ${processedDevices.length} devices` };

        } catch (error) {
            context.error('Error in getDevices function:', error);
            throw error;
        }
    }
});

/**
 * Validates required environment variables are present.
 * @private
 * @param {Object} context - Azure Function context for logging
 * @throws {Error} If required environment variables are missing
 */
async function validateEnvironment(context) {
    context.log('Validating environment variables...');
    const requiredVars = {
        FUNCTIONS_WORKER_RUNTIME: process.env.FUNCTIONS_WORKER_RUNTIME,
        NinjaBaseUrl: process.env.NinjaBaseUrl,
        NinjaClientID: process.env.NinjaClientID,
        NinjaClientSecret: process.env.NinjaClientSecret,
        SnipeBaseURL: process.env.SnipeBaseURL,
        SnipeAPIKey: process.env.SnipeAPIKey ? 'exists' : 'missing'
    };

    context.log('Environment variables:', requiredVars);

    if (!process.env.SnipeBaseURL || !process.env.SnipeAPIKey || 
        !process.env.NinjaBaseUrl || !process.env.NinjaClientID || !process.env.NinjaClientSecret) {
        throw new Error('Required environment variables are missing');
    }
} 