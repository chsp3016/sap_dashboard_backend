// services/xmlExtraction/adapterExtractor.js
const BaseXmlExtractor = require('./baseExtractor');
const logger = require('../../utils/logger');

/**
 * Adapter extraction from iFlow XML
 */
class AdapterExtractor extends BaseXmlExtractor {
  /**
   * Extract adapter information from parsed iFlow XML
   * @param {Object} parsedXml - Parsed XML object
   * @param {string} flowId - Flow ID for logging
   * @returns {Array} Array of adapter resources
   */
  extractAdapters(parsedXml, flowId) {
    try {
      if (!parsedXml || !parsedXml['bpmn2:definitions']) {
        logger.warn('Invalid or missing parsed XML', { flowId });
        return [];
      }

      const messageFlows = this.getMessageFlows(parsedXml);
      
      logger.debug('Extracted message flows', { 
        flowId, 
        messageFlowCount: messageFlows.length,
        messageFlowIds: messageFlows.map(f => f.id || f.name || 'Unnamed')
      });

      if (messageFlows.length === 0) {
        logger.warn('No message flows found in XML', { flowId });
        return [];
      }

      // Process each message flow to extract adapter information
      return messageFlows
        .map((flow, index) => this.processMessageFlow(flow, index, flowId))
        .filter(resource => resource !== null);
    } catch (error) {
      logger.error('Error extracting adapters from XML', { 
        flowId, 
        error: error.message, 
        stack: error.stack 
      });
      return [];
    }
  }

  /**
   * Process individual message flow for adapter information
   * @param {Object} flow - Message flow object
   * @param {number} index - Flow index
   * @param {string} flowId - Flow ID for logging
   * @returns {Object|null} Adapter resource or null
   */
  processMessageFlow(flow, index, flowId) {
    logger.debug('Processing message flow', { 
      flowId, 
      messageFlowIndex: index, 
      messageFlowId: flow.id || flow.name || `MessageFlow_${index}` 
    });

    // Extract extensionElements
    const extensionElements = flow['bpmn2:extensionElements'];
    if (!extensionElements) {
      logger.debug('No extensionElements found in message flow', { 
        flowId, 
        messageFlowId: flow.id || flow.name 
      });
      return null;
    }

    // Extract properties
    let properties = extensionElements['ifl:property'] || [];
    if (!Array.isArray(properties)) {
      properties = properties ? [properties] : [];
    }

    // Extract required adapter information
    const adapterName = this.getPropertyValue(properties, 'Name') || flow.id || `Adapter_${index}`;
    const adapterType = this.getPropertyValue(properties, 'ComponentType') || 'Unknown';
    const adapterCategory = this.getPropertyValue(properties, 'direction') || 'Unknown';

    logger.debug('Extracted properties', { 
      flowId, 
      messageFlowId: flow.id || flow.name, 
      adapterName,
      adapterType,
      adapterCategory,
      totalProperties: properties.length,
      availableKeys: properties.map(p => p.key ? p.key._ : 'Unknown').filter(k => k)
    });

    // Skip if critical information is missing
    if (adapterType === 'Unknown' && adapterCategory === 'Unknown') {
      logger.warn('Skipping adapter due to missing ComponentType and direction', { 
        flowId, 
        messageFlowId: flow.id || flow.name, 
        adapterName,
        availableProperties: properties.map(p => p.key ? p.key._ : 'Unknown').filter(k => k)
      });
      return null;
    }

    // Extract cmdVariantUri for additional configuration
    const cmdVariantUri = this.getPropertyValue(properties, 'cmdVariantUri') || 'N/A';

    // Prepare Content for configuration - collect all properties
    const contentProps = {};
    properties.forEach(prop => {
      if (prop.key && prop.key._ && prop.value) {
        const key = prop.key._;
        const value = prop.value._ || '';
        contentProps[key] = value;
      }
    });
    
    // Add additional flow information
    if (flow.id) contentProps.id = flow.id;
    if (adapterName) contentProps.name = adapterName;

    const resource = {
      Name: adapterName,
      '$': { id: flow.id || adapterName },
      ComponentType: adapterType,
      cmdVariantUri: cmdVariantUri,
      Content: JSON.stringify(contentProps)
    };

    logger.debug('Processed adapter resource', { 
      flowId, 
      adapterName, 
      adapterType, 
      adapterCategory,
      cmdVariantUri
    });

    return {
      adapter_name: adapterName,
      adapter_type: adapterType,
      adapter_category: adapterCategory,
      direction: adapterCategory,
      configuration: {
        content: resource.Content,
        resourceMetadata: {
          name: resource.Name,
          cmdVariantUri: resource.cmdVariantUri,
          componentType: resource.ComponentType
        }
      }
    };
  }
}

module.exports = AdapterExtractor;