/**
 * Sample MCP Plugin
 * 
 * Demonstrates how to create a plugin for the MCP Server
 */

const { z } = require('zod');
const { toolSuccess, toolFailure, textJson } = require('../lib/mcp-response');
const { ErrorCodes, makeError } = require('../lib/errors');

// Example business logic function
async function getSampleData(args) {
    // Simulate some business logic
    return {
        message: `Hello from sample plugin! Received: ${args.input}`,
        timestamp: new Date().toISOString(),
        processed: true
    };
}

// Define the plugin
const samplePlugin = {
    id: 'sample-business-tools',
    name: 'Sample Business Tools',
    version: '1.0.0',
    description: 'A sample plugin demonstrating MCP plugin system',
    
    // Define the tools provided by this plugin
    tools: [
        {
            name: 'get_sample_data',
            description: 'Get sample business data for demonstration purposes. This is a sample tool showing plugin functionality.',
            parameters: {
                input: z.string().min(1).describe('Input string to process'),
                includeTimestamp: z.boolean().optional().default(true).describe('Whether to include timestamp in response')
            },
            handler: async (args) => {
                try {
                    const result = await getSampleData(args);
                    
                    // Conditionally include timestamp based on parameter
                    if (!args.includeTimestamp) {
                        delete result.timestamp;
                    }
                    
                    return textJson(toolSuccess('get_sample_data', result));
                } catch (error) {
                    return textJson(toolFailure(
                        'get_sample_data', 
                        makeError(ErrorCodes.INTERNAL, `Failed to get sample data: ${error.message}`)
                    ));
                }
            }
        },
        {
            name: 'calculate_metrics',
            description: 'Calculate business metrics based on input parameters',
            parameters: {
                values: z.array(z.number()).min(1).describe('Array of numeric values to calculate metrics for'),
                operation: z.enum(['sum', 'average', 'min', 'max']).describe('Operation to perform on values')
            },
            handler: async (args) => {
                try {
                    let result;
                    
                    switch (args.operation) {
                        case 'sum':
                            result = args.values.reduce((sum, val) => sum + val, 0);
                            break;
                        case 'average':
                            result = args.values.reduce((sum, val) => sum + val, 0) / args.values.length;
                            break;
                        case 'min':
                            result = Math.min(...args.values);
                            break;
                        case 'max':
                            result = Math.max(...args.values);
                            break;
                        default:
                            throw new Error(`Unsupported operation: ${args.operation}`);
                    }
                    
                    return textJson(toolSuccess('calculate_metrics', {
                        operation: args.operation,
                        values: args.values,
                        result: result,
                        count: args.values.length
                    }));
                } catch (error) {
                    return textJson(toolFailure(
                        'calculate_metrics', 
                        makeError(ErrorCodes.INVALID_INPUT, `Invalid calculation parameters: ${error.message}`)
                    ));
                }
            }
        }
    ],
    
    // Optional initialization function
    init: async (server) => {
        console.log('[sample-plugin] Initializing sample plugin...');
        // Perform any initialization needed
        // For example, connecting to external services, loading configuration, etc.
    },
    
    // Optional cleanup function
    cleanup: async (server) => {
        console.log('[sample-plugin] Cleaning up sample plugin...');
        // Perform any cleanup needed when plugin is unloaded
    }
};

module.exports = samplePlugin;