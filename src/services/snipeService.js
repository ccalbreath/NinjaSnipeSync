/**
 * @fileoverview Service layer for interacting with Snipe-IT API.
 * @module SnipeService
 * @requires axios
 */

const axios = require('axios');

/**
 * Class representing a Snipe-IT service.
 * Handles all interactions with the Snipe-IT API including rate limiting and caching.
 */
class SnipeService {
    /**
     * Create a SnipeService instance.
     * @param {string} baseURL - The base URL for the Snipe-IT API
     * @param {string} apiKey - API key for authentication
     * @throws {Error} If baseURL or apiKey is not provided
     */
    constructor(baseURL, apiKey) {
        if (!baseURL) {
            throw new Error('SnipeBaseURL is required but was not provided');
        }
        if (!apiKey) {
            throw new Error('SnipeAPIKey is required but was not provided');
        }

        console.log('Initializing SnipeService with base URL:', baseURL);
        
        // Remove trailing slash if it exists
        const normalizedBaseURL = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
        
        this.client = axios.create({
            baseURL: normalizedBaseURL,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        this.modelCache = new Map();
        this.manufacturerCache = new Map();
        this.categoryCache = new Map();
        
        // Rate limiting settings
        this.requestDelay = 1000; // 1 second between requests
        this.lastRequestTime = 0;
    }

    /**
     * Makes a rate-limited request to the Snipe-IT API.
     * @private
     * @param {Function} requestFn - Function that returns a promise for the API request
     * @param {Object} context - Azure Function context for logging
     * @returns {Promise<Object>} Response from the API
     * @throws {Error} If the request fails
     */
    async rateLimitedRequest(requestFn, context) {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.requestDelay) {
            const delayNeeded = this.requestDelay - timeSinceLastRequest;
            context.log(`Rate limiting: waiting ${delayNeeded}ms before next request`);
            await new Promise(resolve => setTimeout(resolve, delayNeeded));
        }

        try {
            const result = await requestFn();
            this.lastRequestTime = Date.now();
            return result;
        } catch (error) {
            if (error.response?.status === 429) {
                context.log('Rate limit hit, waiting before retry...');
                await new Promise(resolve => setTimeout(resolve, this.requestDelay * 2));
                return await requestFn();
            }
            throw error;
        }
    }

    /**
     * Retrieves all manufacturers from Snipe-IT and updates the cache.
     * @param {Object} context - Azure Function context for logging
     * @returns {Promise<Array>} Array of manufacturer objects
     * @throws {Error} If the API request fails
     */
    async getManufacturers(context) {
        try {
            const fullUrl = `${this.client.defaults.baseURL}/manufacturers`;
            context.log('Fetching manufacturers from URL:', fullUrl);
            
            const response = await this.rateLimitedRequest(
                () => this.client.get('manufacturers'),
                context
            );
            
            const manufacturers = response.data.rows;
            this.manufacturerCache.clear();
            manufacturers.forEach(manufacturer => {
                this.manufacturerCache.set(manufacturer.name.toLowerCase(), manufacturer);
            });

            context.log(`Retrieved ${manufacturers.length} manufacturers from Snipe-IT`);
            return manufacturers;
        } catch (error) {
            context.error('Error fetching manufacturers from Snipe-IT:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Creates a new manufacturer in Snipe-IT.
     * @param {string} manufacturerName - Name of the manufacturer to create
     * @param {Object} context - Azure Function context for logging
     * @returns {Promise<Object>} Created manufacturer object
     * @throws {Error} If manufacturer creation fails
     */
    async createManufacturer(manufacturerName, context) {
        try {
            const manufacturerData = {
                name: manufacturerName,
                url: '',
                support_url: '',
                support_phone: '',
                support_email: '',
                notes: 'Created automatically from Ninja RMM sync'
            };

            const response = await this.rateLimitedRequest(
                () => this.client.post('manufacturers', manufacturerData),
                context
            );
            
            const newManufacturer = response.data;
            this.manufacturerCache.set(manufacturerName.toLowerCase(), newManufacturer);
            
            context.log(`Created new manufacturer in Snipe-IT: ${manufacturerName}`);
            return newManufacturer;
        } catch (error) {
            context.error(`Error creating manufacturer ${manufacturerName}:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Gets or creates a manufacturer in Snipe-IT.
     * @param {string} manufacturerName - Name of the manufacturer
     * @param {Object} context - Azure Function context for logging
     * @returns {Promise<Object>} Manufacturer object
     * @throws {Error} If manufacturer creation fails
     */
    async getOrCreateManufacturer(manufacturerName, context) {
        if (!manufacturerName) {
            manufacturerName = 'Unknown Manufacturer';
        }

        // Check cache first
        const cachedManufacturer = this.manufacturerCache.get(manufacturerName.toLowerCase());
        if (cachedManufacturer) {
            return cachedManufacturer;
        }

        // If not in cache, try to create it
        try {
            return await this.createManufacturer(manufacturerName, context);
        } catch (error) {
            context.error(`Failed to get/create manufacturer ${manufacturerName}:`, error);
            throw error;
        }
    }

    /**
     * Retrieves all models from Snipe-IT and updates the cache.
     * @param {Object} context - Azure Function context for logging
     * @returns {Promise<Array>} Array of model objects
     * @throws {Error} If the API request fails
     */
    async getModels(context) {
        try {
            const response = await this.rateLimitedRequest(
                () => this.client.get('models'),
                context
            );
            
            const models = response.data.rows;
            this.modelCache.clear();
            models.forEach(model => {
                this.modelCache.set(model.name.toLowerCase(), model);
            });

            context.log(`Retrieved ${models.length} models from Snipe-IT`);
            return models;
        } catch (error) {
            context.error('Error fetching models from Snipe-IT:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Retrieves all categories from Snipe-IT and updates the cache.
     * @param {Object} context - Azure Function context for logging
     * @returns {Promise<Array>} Array of category objects
     * @throws {Error} If the API request fails
     */
    async getCategories(context) {
        try {
            const response = await this.rateLimitedRequest(
                () => this.client.get('categories'),
                context
            );
            
            const categories = response.data.rows;
            this.categoryCache.clear();
            categories.forEach(category => {
                this.categoryCache.set(category.name.toLowerCase(), category);
            });

            context.log(`Retrieved ${categories.length} categories from Snipe-IT`);
            return categories;
        } catch (error) {
            context.error('Error fetching categories from Snipe-IT:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Creates a new category in Snipe-IT.
     * @param {string} categoryName - Name of the category to create
     * @param {Object} context - Azure Function context for logging
     * @returns {Promise<Object>} Created category object
     * @throws {Error} If category creation fails
     */
    async createCategory(categoryName, context) {
        try {
            const categoryData = {
                name: categoryName,
                category_type: 'asset',
                type: 'asset',
                use_default_eula: 0,
                require_acceptance: 0,
                checkin_email: 0,
                eula_text: null,
                notes: 'Created automatically from Ninja RMM sync'
            };

            context.log('Creating category with data:', JSON.stringify(categoryData));

            const response = await this.rateLimitedRequest(
                () => this.client.post('categories', categoryData),
                context
            );
            
            if (response.data.status === 'error') {
                throw new Error(`Failed to create category ${categoryName}. Response: ${JSON.stringify(response.data)}`);
            }

            const newCategory = response.data.payload || response.data;
            this.categoryCache.set(newCategory.name.toLowerCase(), newCategory);
            
            context.log(`Created new asset category: ${newCategory.name} with ID: ${newCategory.id}`);
            return newCategory;
        } catch (error) {
            context.error('Error creating asset category:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Gets or creates an asset category based on the device's nodeClass.
     * @param {string} nodeClass - Node class from Ninja RMM
     * @param {Object} context - Azure Function context for logging
     * @returns {Promise<Object>} Category object
     * @throws {Error} If category creation/retrieval fails
     */
    async getOrCreateAssetCategory(nodeClass, context) {
        try {
            // Debug log the incoming nodeClass
            context.log(`Getting/Creating category for nodeClass: ${nodeClass}`);

            // Map Ninja nodeClass to category name
            let categoryName;
            switch (nodeClass) {
                case 'WINDOWS_SERVER':
                    categoryName = 'Windows Servers';
                    break;
                case 'WINDOWS_WORKSTATION':
                    categoryName = 'Windows Workstations';
                    break;
                case 'VMWARE_VM_HOST':
                    categoryName = 'VMware Hosts';
                    break;
                default:
                    context.log(`Unrecognized nodeClass: ${nodeClass}, defaulting to Other Hardware`);
                    categoryName = 'Other Hardware';
            }

            context.log(`Mapped nodeClass ${nodeClass} to category ${categoryName}`);

            // First check cache
            const cachedCategory = this.categoryCache.get(categoryName.toLowerCase());
            if (cachedCategory) {
                return cachedCategory;
            }

            // Get all categories
            await this.getCategories(context);
            
            // Look for an existing category with this name
            for (const [name, category] of this.categoryCache) {
                if (name === categoryName.toLowerCase()) {
                    context.log(`Found existing category: ${category.name} with ID: ${category.id}`);
                    return category;
                }
            }

            // If no category exists, create one
            context.log(`No category found for ${categoryName}, creating new one...`);
            return await this.createCategory(categoryName, context);
        } catch (error) {
            context.error('Error getting/creating asset category:', error);
            throw error;
        }
    }

    /**
     * Creates a new model in Snipe-IT.
     * @param {string} modelName - Name of the model
     * @param {number} manufacturer_id - ID of the manufacturer
     * @param {string} nodeClass - Node class from Ninja RMM
     * @param {Object} context - Azure Function context for logging
     * @returns {Promise<Object>} Created model object
     * @throws {Error} If model creation fails
     */
    async createModel(modelName, manufacturer_id, nodeClass, context) {
        try {
            context.log(`Attempting to create model: ${modelName} for manufacturer_id: ${manufacturer_id}, nodeClass: ${nodeClass}`);
            
            if (!manufacturer_id) {
                throw new Error(`Cannot create model ${modelName} without a valid manufacturer_id`);
            }

            // Get or create an asset category based on nodeClass
            const category = await this.getOrCreateAssetCategory(nodeClass, context);
            if (!category || !category.id) {
                throw new Error('Failed to get or create asset category');
            }

            const modelData = {
                name: modelName,
                manufacturer_id: manufacturer_id,
                category_id: category.id,
                model_number: modelName,
                fieldset_id: null,
                notes: 'Created automatically from Ninja RMM sync'
            };

            context.log('Creating model with data:', JSON.stringify(modelData));

            const response = await this.rateLimitedRequest(
                () => this.client.post('models', modelData),
                context
            );
            
            // Changed error handling - only throw if it's actually an error
            if (response.data.status === 'error') {
                throw new Error(`Failed to create model ${modelName}. Response: ${JSON.stringify(response.data)}`);
            }

            const newModel = response.data.payload || response.data;
            this.modelCache.set(modelName.toLowerCase(), newModel);
            
            context.log(`Successfully created new model in Snipe-IT: ${modelName} with ID: ${newModel.id}`);
            return newModel;
        } catch (error) {
            context.error(`Error creating model ${modelName}:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Gets or creates a model in Snipe-IT.
     * @param {string} modelName - Name of the model
     * @param {number} manufacturer_id - ID of the manufacturer
     * @param {string} nodeClass - Node class from Ninja RMM
     * @param {Object} context - Azure Function context for logging
     * @returns {Promise<Object>} Model object
     * @throws {Error} If model creation/retrieval fails
     */
    async getOrCreateModel(modelName, manufacturer_id, nodeClass, context) {
        if (!modelName) {
            modelName = 'Unknown Model';
        }

        context.log(`Looking up model: ${modelName} for nodeClass: ${nodeClass}`);

        try {
            // Get the appropriate category for this nodeClass
            const expectedCategory = await this.getOrCreateAssetCategory(nodeClass, context);
            
            // First try to find by exact name
            const response = await this.rateLimitedRequest(
                () => this.client.get(`models?search=${encodeURIComponent(modelName)}`),
                context
            );

            // Look for any model with matching name, regardless of manufacturer
            const existingModel = response.data.rows.find(m => 
                m.name.toLowerCase() === modelName.toLowerCase()
            );

            if (existingModel) {
                context.log(`Found existing model in Snipe-IT: ${modelName} with ID: ${existingModel.id}`);
                
                // Update model if needed (category or manufacturer changed)
                if (existingModel.category.id !== expectedCategory.id || 
                    existingModel.manufacturer.id !== manufacturer_id) {
                    
                    context.log(`Updating model ${modelName} with new category/manufacturer`);
                    
                    const updateData = {
                        name: modelName,
                        manufacturer_id: manufacturer_id,
                        category_id: expectedCategory.id,
                        model_number: modelName
                    };

                    const updateResponse = await this.rateLimitedRequest(
                        () => this.client.put(`models/${existingModel.id}`, updateData),
                        context
                    );

                    const updatedModel = updateResponse.data.payload || updateResponse.data;
                    this.modelCache.set(modelName.toLowerCase(), updatedModel);
                    return updatedModel;
                }

                this.modelCache.set(modelName.toLowerCase(), existingModel);
                return existingModel;
            }

            // If not found, create it
            context.log(`Model ${modelName} not found, creating new one...`);
            return await this.createModel(modelName, manufacturer_id, nodeClass, context);
        } catch (error) {
            context.error(`Failed to get/create model ${modelName}:`, error);
            throw error;
        }
    }

    /**
     * Synchronizes devices from Ninja RMM to Snipe-IT.
     * @param {Array<Object>} devices - Array of device objects from Ninja RMM
     * @param {Object} context - Azure Function context for logging
     * @returns {Promise<void>}
     * @throws {Error} If synchronization fails
     */
    async syncDevices(devices, context) {
        try {
            // First, get ALL existing data in bulk
            context.log('Pre-loading all Snipe-IT data...');
            
            // Get all categories
            const categories = await this.getCategories(context);
            context.log(`Loaded ${categories.length} categories`);
            
            // Get all manufacturers
            const manufacturers = await this.getManufacturers(context);
            context.log(`Loaded ${manufacturers.length} manufacturers`);
            
            // Get all models
            const models = await this.getModels(context);
            context.log(`Loaded ${models.length} models`);
            
            // Get all assets in one call
            const assets = await this.rateLimitedRequest(
                () => this.client.get('hardware'),
                context
            );
            const existingAssets = assets.data.rows;
            context.log(`Loaded ${existingAssets.length} assets`);

            // Create lookup maps for quick access
            const assetsBySerial = new Map(
                existingAssets.map(asset => [asset.serial.toLowerCase(), asset])
            );
            const modelsByName = new Map(
                models.map(model => [model.name.toLowerCase(), model])
            );
            const manufacturersByName = new Map(
                manufacturers.map(manufacturer => [manufacturer.name.toLowerCase(), manufacturer])
            );

            // Then sync each device using the cached data
            for (const device of devices) {
                try {
                    await this.syncDeviceWithCache(
                        device, 
                        manufacturersByName,
                        modelsByName,
                        assetsBySerial,
                        context
                    );
                } catch (error) {
                    context.error(`Failed to sync device ${device.system.serialNumber}:`, error);
                }
            }
            context.log(`Completed Snipe-IT sync for ${devices.length} devices`);
        } catch (error) {
            context.error('Error during device sync:', error);
            throw error;
        }
    }

    /**
     * Synchronizes a single device using cached data.
     * @param {Object} device - Device object from Ninja RMM
     * @param {Map} manufacturersByName - Cache of manufacturers
     * @param {Map} modelsByName - Cache of models
     * @param {Map} assetsBySerial - Cache of assets
     * @param {Object} context - Azure Function context for logging
     * @returns {Promise<void>}
     * @throws {Error} If device sync fails
     */
    async syncDeviceWithCache(device, manufacturersByName, modelsByName, assetsBySerial, context) {
        try {
            context.log(`Processing device with nodeClass: ${device.nodeClass}, systemName: ${device.systemName}, model: ${device.system.model}`);

            // Get or create manufacturer using cache
            let manufacturer = manufacturersByName.get(device.system.manufacturer.toLowerCase());
            if (!manufacturer) {
                manufacturer = await this.createManufacturer(device.system.manufacturer, context);
                manufacturersByName.set(device.system.manufacturer.toLowerCase(), manufacturer);
            }

            // Debug logging for manufacturer
            context.log(`Using manufacturer: ${JSON.stringify(manufacturer)}`);

            // Get or create model using cache - UPDATED LOGIC
            const modelKey = device.system.model.toLowerCase();
            let model = modelsByName.get(modelKey);
            
            // Debug logging for model
            context.log(`Found model in cache: ${model ? JSON.stringify(model) : 'null'}`);
            
            if (model) {
                // Add defensive checks
                if (!model.manufacturer || !model.manufacturer.id) {
                    context.log(`Model found but missing manufacturer info: ${JSON.stringify(model)}`);
                    // Fetch fresh model data
                    const modelResponse = await this.rateLimitedRequest(
                        () => this.client.get(`models/${model.id}`),
                        context
                    );
                    model = modelResponse.data;
                    modelsByName.set(modelKey, model);
                }

                // If model exists but needs updates
                if (model.manufacturer.id !== manufacturer.id || 
                    !this.isModelCategoryCorrect(model, device.nodeClass)) {
                    
                    context.log(`Updating existing model ${model.name} with new category/manufacturer`);
                    const updateData = {
                        name: device.system.model,
                        manufacturer_id: manufacturer.id,
                        category_id: (await this.getOrCreateAssetCategory(device.nodeClass, context)).id,
                        model_number: device.system.model
                    };

                    const updateResponse = await this.rateLimitedRequest(
                        () => this.client.put(`models/${model.id}`, updateData),
                        context
                    );
                    model = updateResponse.data.payload || updateResponse.data;
                    modelsByName.set(modelKey, model);
                }
            } else {
                // If model doesn't exist in cache, try to find it in Snipe-IT
                const response = await this.rateLimitedRequest(
                    () => this.client.get(`models?search=${encodeURIComponent(device.system.model)}`),
                    context
                );

                const existingModel = response.data.rows.find(m => 
                    m.name.toLowerCase() === device.system.model.toLowerCase()
                );

                if (existingModel) {
                    model = existingModel;
                    modelsByName.set(modelKey, model);
                    
                    // Update if needed
                    if (model.manufacturer.id !== manufacturer.id || 
                        !this.isModelCategoryCorrect(model, device.nodeClass)) {
                        
                        context.log(`Updating found model ${model.name} with new category/manufacturer`);
                        const updateData = {
                            name: device.system.model,
                            manufacturer_id: manufacturer.id,
                            category_id: (await this.getOrCreateAssetCategory(device.nodeClass, context)).id,
                            model_number: device.system.model
                        };

                        const updateResponse = await this.rateLimitedRequest(
                            () => this.client.put(`models/${model.id}`, updateData),
                            context
                        );
                        model = updateResponse.data.payload || updateResponse.data;
                        modelsByName.set(modelKey, model);
                    }
                } else {
                    // Only create if we really can't find it
                    model = await this.createModel(device.system.model, manufacturer.id, device.nodeClass, context);
                    modelsByName.set(modelKey, model);
                }
            }

            // Check if asset exists using cache
            const existingAsset = assetsBySerial.get(device.system.serialNumber.toLowerCase());
            
            if (existingAsset) {
                // Update existing asset if needed
                const changedFields = this.getChangedFields(device, existingAsset, model, manufacturer);
                
                if (Object.keys(changedFields).length > 0) {
                    await this.rateLimitedRequest(
                        () => this.client.patch(`hardware/${existingAsset.id}`, changedFields),
                        context
                    );
                    context.log(`Updated Snipe-IT asset: ${device.system.serialNumber} with changes:`, changedFields);
                } else {
                    context.log(`No changes needed for Snipe-IT asset: ${device.system.serialNumber}`);
                }
            } else {
                // Create new asset
                const assetData = this.createAssetData(device, model, manufacturer);
                await this.rateLimitedRequest(
                    () => this.client.post('hardware', assetData),
                    context
                );
                context.log(`Created new Snipe-IT asset: ${device.system.serialNumber}`);
            }
        } catch (error) {
            context.error(`Error syncing device ${device.system.serialNumber}:`, error);
            throw error;
        }
    }

    /**
     * Checks if a model's category matches the expected category for a nodeClass.
     * @private
     * @param {Object} model - Model object from Snipe-IT
     * @param {string} nodeClass - Node class from Ninja RMM
     * @returns {boolean} True if category matches
     */
    isModelCategoryCorrect(model, nodeClass) {
        const expectedCategoryName = this.getExpectedCategoryName(nodeClass);
        return model.category.name.toLowerCase() === expectedCategoryName.toLowerCase();
    }

    /**
     * Gets the expected category name for a nodeClass.
     * @private
     * @param {string} nodeClass - Node class from Ninja RMM
     * @returns {string} Category name
     */
    getExpectedCategoryName(nodeClass) {
        switch (nodeClass) {
            case 'WINDOWS_SERVER': return 'Windows Servers';
            case 'WINDOWS_WORKSTATION': return 'Windows Workstations';
            case 'VMWARE_VM_HOST': return 'VMware Hosts';
            default: return 'Other Hardware';
        }
    }

    /**
     * Determines which fields need to be updated for an existing asset.
     * @private
     * @param {Object} device - Device object from Ninja RMM
     * @param {Object} existingAsset - Existing asset from Snipe-IT
     * @param {Object} model - Model object
     * @param {Object} manufacturer - Manufacturer object
     * @returns {Object} Object containing fields that need updating
     */
    getChangedFields(device, existingAsset, model, manufacturer) {
        const changedFields = {};

        if (device.systemName !== existingAsset.name) {
            changedFields.name = device.systemName;
        }
        if (model.id !== existingAsset.model.id) {
            changedFields.model_id = model.id;
        }
        if (manufacturer.id !== existingAsset.manufacturer.id) {
            changedFields.manufacturer_id = manufacturer.id;
        }
        if (device.system.model !== existingAsset.model_number) {
            changedFields.model_number = device.system.model;
        }

        // Always update custom fields and notes
        changedFields.custom_fields = {
            _snipeit_processor_count_1: device.system.numberOfProcessors,
            _snipeit_memory_2: Math.round(device.system.totalPhysicalMemory / (1024 * 1024 * 1024))
        };
        changedFields.notes = `Last synced from Ninja RMM: ${new Date().toISOString()}\nDomain: ${device.system.domain}\nRole: ${device.system.domainRole}`;

        return changedFields;
    }

    /**
     * Creates asset data object for Snipe-IT API.
     * @private
     * @param {Object} device - Device object from Ninja RMM
     * @param {Object} model - Model object
     * @param {Object} manufacturer - Manufacturer object
     * @returns {Object} Asset data object
     */
    createAssetData(device, model, manufacturer) {
        return {
            status_id: 1,
            model_id: model.id,
            name: device.systemName,
            serial: device.system.serialNumber,
            manufacturer_id: manufacturer.id,
            model_number: device.system.model,
            notes: `Last synced from Ninja RMM: ${new Date().toISOString()}\nDomain: ${device.system.domain}\nRole: ${device.system.domainRole}`,
            custom_fields: {
                _snipeit_processor_count_1: device.system.numberOfProcessors,
                _snipeit_memory_2: Math.round(device.system.totalPhysicalMemory / (1024 * 1024 * 1024))
            }
        };
    }
}

module.exports = SnipeService; 