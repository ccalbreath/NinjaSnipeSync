/**
 * @fileoverview Service layer for interacting with Ninja RMM API.
 * @module NinjaService
 * @requires axios
 */

const axios = require('axios');

/**
 * Class representing a Ninja RMM service.
 * Handles all interactions with the Ninja RMM API.
 */
class NinjaService {
    /**
     * Create a NinjaService instance.
     * @param {string} baseUrl - The base URL for the Ninja RMM API
     * @param {string} clientId - OAuth client ID
     * @param {string} clientSecret - OAuth client secret
     * @throws {Error} If required parameters are not provided
     */
    constructor(baseUrl, clientId, clientSecret) {
        if (!baseUrl || !clientId || !clientSecret) {
            throw new Error('Required Ninja RMM parameters are missing');
        }

        // Ensure baseUrl is properly formatted
        try {
            // Test if it's a valid URL and has protocol
            new URL(baseUrl);
            this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        } catch (error) {
            throw new Error(`Invalid baseUrl: ${baseUrl}. Must include protocol (e.g., https://)`);
        }

        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    /**
     * Gets an OAuth token from Ninja RMM API.
     * @private
     * @param {Object} context - Azure Function context for logging
     * @returns {Promise<string>} Access token
     * @throws {Error} If token acquisition fails
     */
    async getToken(context) {
        try {
            const params = new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: this.clientId,
                client_secret: this.clientSecret,
                scope: 'monitoring',
                code: 'string',
                refresh_token: 'string',
                redirect_uri: 'http://localhost',
                code_verifier: 'string'
            });

            // Construct and validate URL
            let authEndpoint;
            try {
                context.log('Base URL:', this.baseUrl);
                context.log('Auth endpoint path:', process.env.NinjaAuthEndpoint);
                authEndpoint = new URL(process.env.NinjaAuthEndpoint, this.baseUrl);
                context.log('Constructed auth endpoint:', authEndpoint.toString());
            } catch (error) {
                throw new Error(`Failed to construct auth URL: ${error.message}`);
            }

            const response = await axios.post(authEndpoint.toString(), params, {
                headers: {
                    'accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            return response.data.access_token;
        } catch (error) {
            context.error('Token acquisition failed:', error);
            throw error;
        }
    }

    /**
     * Retrieves device data from Ninja RMM API.
     * @param {Object} context - Azure Function context for logging
     * @returns {Promise<Array>} Array of device objects
     * @throws {Error} If API call fails
     */
    async getDevices(context) {
        try {
            const accessToken = await this.getToken(context);
            context.log('Successfully obtained access token');

            // Construct and validate URL
            let deviceEndpoint;
            try {
                context.log('Base URL:', this.baseUrl);
                context.log('Device endpoint path:', process.env.NinjaDeviceDetailEndpoint);
                deviceEndpoint = new URL(process.env.NinjaDeviceDetailEndpoint, this.baseUrl);
                context.log('Constructed device endpoint:', deviceEndpoint.toString());
            } catch (error) {
                throw new Error(`Failed to construct device URL: ${error.message}`);
            }

            const response = await axios.get(deviceEndpoint.toString(), {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            return response.data;
        } catch (error) {
            context.error('Device retrieval failed:', error);
            throw error;
        }
    }

    /**
     * Processes and filters device data.
     * @param {Array<Object>} devices - Raw device data
     * @param {Object} context - Azure Function context for logging
     * @returns {Array<Object>} Processed device data
     */
    processDevices(devices, context) {
        return devices
            .filter(device => 
                device.nodeClass !== 'VMWARE_VM_GUEST' && 
                device.nodeClass !== 'CLOUD_MONITOR_TARGET'
            )
            .map(device => {
                context.log('Processing device:', device.id, device.systemName, device.nodeClass);
                return this.createDeviceDetails(device);
            });
    }

    /**
     * Creates a standardized device details object.
     * @private
     * @param {Object} device - Raw device data
     * @returns {Object} Standardized device details
     */
    createDeviceDetails(device) {
        if (!device.system && device.nodeClass !== 'VMWARE_VM_HOST') {
            return this.createDefaultDeviceDetails(device);
        } else if (device.nodeClass === 'VMWARE_VM_HOST') {
            return this.createVMwareHostDetails(device);
        } else {
            return this.createStandardDeviceDetails(device);
        }
    }

    /**
     * Creates device details for devices with missing system information.
     * @private
     * @param {Object} device - Raw device data
     * @returns {Object} Device details with default values
     */
    createDefaultDeviceDetails(device) {
        return {
            id: device.id,
            systemName: device.systemName,
            nodeClass: device.nodeClass,
            system: {
                name: device.systemName || 'Unknown',
                manufacturer: 'Unknown',
                model: 'Unknown',
                biosSerialNumber: 'Unknown',
                serialNumber: 'Unknown',
                domain: 'Unknown',
                domainRole: 'Unknown',
                numberOfProcessors: 0,
                totalPhysicalMemory: 0,
                virtualMachine: false,
                chassisType: 'Unknown'
            }
        };
    }

    /**
     * Creates device details for VMware hosts.
     * @private
     * @param {Object} device - Raw device data
     * @returns {Object} VMware host details
     */
    createVMwareHostDetails(device) {
        return {
            id: device.id,
            systemName: device.systemName,
            nodeClass: device.nodeClass,
            system: {
                name: device.name || 'Unknown',
                manufacturer: device.vendor || 'Unknown',
                model: device.model || 'Unknown',
                biosSerialNumber: device.biosSerialNumber || 'Unknown',
                serialNumber: device.serialNumber || 'Unknown',
                domain: device.domain || 'Unknown',
                domainRole: device.domainRole || 'Unknown',
                numberOfProcessors: device.numberOfProcessors || 0,
                totalPhysicalMemory: device.totalPhysicalMemory || 0,
                virtualMachine: true,
                chassisType: device.chassisType || 'Unknown'
            }
        };
    }

    /**
     * Creates device details for standard devices.
     * @private
     * @param {Object} device - Raw device data
     * @returns {Object} Standard device details
     */
    createStandardDeviceDetails(device) {
        return {
            id: device.id,
            systemName: device.systemName,
            nodeClass: device.nodeClass,
            system: {
                name: device.system.name,
                manufacturer: device.system.manufacturer,
                model: device.system.model,
                biosSerialNumber: device.system.biosSerialNumber,
                serialNumber: device.system.serialNumber,
                domain: device.system.domain,
                domainRole: device.system.domainRole,
                numberOfProcessors: device.system.numberOfProcessors,
                totalPhysicalMemory: device.system.totalPhysicalMemory,
                virtualMachine: device.system.virtualMachine,
                chassisType: device.system.chassisType
            }
        };
    }
}

module.exports = NinjaService; 