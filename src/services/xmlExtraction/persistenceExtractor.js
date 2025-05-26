// services/xmlExtraction/persistenceExtractor.js
const BaseXmlExtractor = require('./baseExtractor');
const logger = require('../../utils/logger');

/**
 * Persistence mechanisms extraction from iFlow XML
 */
class PersistenceExtractor extends BaseXmlExtractor {
  /**
   * Extract persistence configuration from parsed iFlow XML
   * @param {Object} parsedXml - Parsed XML object
   * @param {string} flowId - Flow ID for logging
   * @returns {Object} Persistence configuration
   */
  extractPersistence(parsedXml, flowId) {
    try {
      if (!parsedXml || !parsedXml['bpmn2:definitions']) {
        logger.warn('Invalid or missing parsed XML for persistence extraction', { flowId });
        return this.getDefaultPersistence();
      }

      const persistence = this.getDefaultPersistence();
      
      // Extract persistence from collaboration level
      const collaborationPersistence = this.extractCollaborationPersistence(parsedXml, flowId);
      Object.assign(persistence, collaborationPersistence);

      // Extract persistence from processes
      const processPersistence = this.extractProcessPersistence(parsedXml, flowId);
      this.mergePersistenceDetails(persistence, processPersistence);

      // Extract adapter-level persistence
      const adapterPersistence = this.extractAdapterPersistence(parsedXml, flowId);
      this.mergePersistenceDetails(persistence, adapterPersistence);

      logger.debug('Persistence extraction completed', { 
        flowId, 
        persistence 
      });

      return persistence;
    } catch (error) {
      logger.error('Error extracting persistence from XML', { 
        flowId, 
        error: error.message, 
        stack: error.stack 
      });
      return this.getDefaultPersistence();
    }
  }

  /**
   * Get default persistence configuration
   * @returns {Object} Default persistence configuration
   */
  getDefaultPersistence() {
    return {
      jms_enabled: false,
      data_store_enabled: false,
      variables_enabled: false,
      message_persistence_enabled: false,
      persistence_details: {
        jmsAdapters: [],
        messagePersistence: [],
        dataStoreOperations: [],
        dataStoreActivities: [],
        variableOperations: [],
        externalCalls: [],
        transactionalHandling: 'None',
        processType: 'undefined',
        directCall: false
      }
    };
  }

  /**
   * Extract persistence from collaboration level
   * @param {Object} parsedXml - Parsed XML object
   * @param {string} flowId - Flow ID for logging
   * @returns {Object} Collaboration persistence configuration
   */
  extractCollaborationPersistence(parsedXml, flowId) {
    const persistence = {};
    const collaborationProps = this.getCollaborationProperties(parsedXml);
    
    collaborationProps.forEach(prop => {
      if (prop && prop.key && prop.key._) {
        const key = prop.key._;
        const value = prop.value ? prop.value._ : '';
        
        // Check for transactional handling
        if (key === 'transactionalHandling') {
          persistence.transactionalHandling = value;
          if (value && value !== 'None') {
            persistence.message_persistence_enabled = true;
          }
        }
        
        // Check for process type (direct call indicator)
        if (key === 'processType') {
          persistence.processType = value;
          persistence.directCall = value === 'ProcessDirect';
        }
        
        // Check for message persistence settings
        if (key === 'messagePersistenceEnabled' || key === 'persist') {
          persistence.message_persistence_enabled = value === 'true';
        }
      }
    });

    return persistence;
  }

  /**
   * Extract persistence from processes
   * @param {Object} parsedXml - Parsed XML object
   * @param {string} flowId - Flow ID for logging
   * @returns {Object} Process persistence details
   */
  extractProcessPersistence(parsedXml, flowId) {
    const processDetails = {
      dataStoreActivities: [],
      variableOperations: [],
      externalCalls: []
    };
    
    try {
      const definitions = parsedXml['bpmn2:definitions'];
      if (!definitions) {
        return processDetails;
      }

      // Look for processes
      const processes = definitions['bpmn2:process'];
      if (!processes) {
        return processDetails;
      }

      const processArray = Array.isArray(processes) ? processes : [processes];
      
      processArray.forEach((process, index) => {
        const processId = process.id || `Process_${index}`;
        const processName = process.name || processId;
        
        logger.debug('Processing process for persistence', { 
          flowId, 
          processId, 
          processName 
        });

        // Extract data store activities
        const dataStoreActivities = this.findDataStoreActivities(process, flowId);
        processDetails.dataStoreActivities.push(...dataStoreActivities);

        // Extract variable operations
        const variableOperations = this.findVariableOperations(process, flowId);
        processDetails.variableOperations.push(...variableOperations);

        // Extract external calls
        const externalCalls = this.findExternalCalls(process, flowId);
        processDetails.externalCalls.push(...externalCalls);
      });

    } catch (error) {
      logger.error('Error extracting process persistence', { 
        flowId, 
        error: error.message 
      });
    }

    return processDetails;
  }

  /**
   * Extract adapter-level persistence
   * @param {Object} parsedXml - Parsed XML object
   * @param {string} flowId - Flow ID for logging
   * @returns {Object} Adapter persistence details
   */
  extractAdapterPersistence(parsedXml, flowId) {
    const adapterPersistence = {
      jmsAdapters: [],
      messagePersistence: [],
      dataStoreOperations: []
    };

    const messageFlows = this.getMessageFlows(parsedXml);

    messageFlows.forEach((flow, index) => {
      logger.debug('Processing message flow for persistence', { 
        flowId, 
        messageFlowIndex: index, 
        messageFlowId: flow.id || flow.name || `MessageFlow_${index}` 
      });

      // Extract extensionElements
      const extensionElements = flow['bpmn2:extensionElements'];
      if (!extensionElements) {
        return;
      }

      // Extract properties
      let properties = extensionElements['ifl:property'] || [];
      if (!Array.isArray(properties)) {
        properties = properties ? [properties] : [];
      }

      const componentType = this.getPropertyValue(properties, 'ComponentType') || 'Unknown';
      const adapterName = this.getPropertyValue(properties, 'Name') || flow.id || `Adapter_${index}`;

      // Check for JMS adapters
      if (componentType.toLowerCase().includes('jms')) {
        const jmsConfig = this.extractJMSConfiguration(properties, adapterName);
        if (jmsConfig) {
          adapterPersistence.jmsAdapters.push(jmsConfig);
        }
      }

      // Check for message persistence configuration
      const messagePersistenceConfig = this.extractMessagePersistenceConfiguration(properties, adapterName, componentType);
      if (messagePersistenceConfig) {
        adapterPersistence.messagePersistence.push(messagePersistenceConfig);
      }

      // Check for data store operations
      const dataStoreConfig = this.extractDataStoreConfiguration(properties, adapterName, componentType);
      if (dataStoreConfig) {
        adapterPersistence.dataStoreOperations.push(dataStoreConfig);
      }
    });

    return adapterPersistence;
  }

  /**
   * Find data store activities in a process
   * @param {Object} process - Process object
   * @param {string} flowId - Flow ID for logging
   * @returns {Array} Array of data store activities
   */
  findDataStoreActivities(process, flowId) {
    const dataStoreActivities = [];
    
    try {
      // Look for script tasks that might interact with data stores
      const scriptTasks = process['bpmn2:scriptTask'];
      if (scriptTasks) {
        const scriptTaskArray = Array.isArray(scriptTasks) ? scriptTasks : [scriptTasks];
        
        scriptTaskArray.forEach(task => {
          const taskProps = task['bpmn2:extensionElements']?.['ifl:property'] || [];
          const propsArray = Array.isArray(taskProps) ? taskProps : [taskProps].filter(Boolean);
          
          // Check for data store related properties
          const hasDataStore = propsArray.some(prop => 
            prop.key?._.toLowerCase().includes('datastore') ||
            prop.key?._.toLowerCase().includes('data_store') ||
            prop.key?._.toLowerCase().includes('store')
          );
          
          if (hasDataStore) {
            dataStoreActivities.push({
              id: task.id || 'UnknownTask',
              name: task.name || 'Data Store Activity',
              type: 'ScriptTask',
              properties: propsArray.map(prop => ({
                key: prop.key?._,
                value: prop.value?._ || ''
              }))
            });
          }
        });
      }

      // Look for service tasks with data store operations
      const serviceTasks = process['bpmn2:serviceTask'];
      if (serviceTasks) {
        const serviceTaskArray = Array.isArray(serviceTasks) ? serviceTasks : [serviceTasks];
        
        serviceTaskArray.forEach(task => {
          const taskProps = task['bpmn2:extensionElements']?.['ifl:property'] || [];
          const propsArray = Array.isArray(taskProps) ? taskProps : [taskProps].filter(Boolean);
          
          // Check if this is a data store operation
          const activityType = propsArray.find(prop => prop.key?._ === 'activityType')?.value?._;
          
          if (activityType && (activityType.includes('DataStore') || activityType.includes('Store'))) {
            dataStoreActivities.push({
              id: task.id || 'UnknownTask',
              name: task.name || 'Data Store Operation',
              type: 'ServiceTask',
              activityType: activityType,
              properties: propsArray.map(prop => ({
                key: prop.key?._,
                value: prop.value?._ || ''
              }))
            });
          }
        });
      }

    } catch (error) {
      logger.error('Error finding data store activities', { 
        flowId, 
        error: error.message 
      });
    }

    return dataStoreActivities;
  }

  /**
   * Find variable operations in a process
   * @param {Object} process - Process object
   * @param {string} flowId - Flow ID for logging
   * @returns {Array} Array of variable operations
   */
  findVariableOperations(process, flowId) {
    const variableOperations = [];
    
    try {
      // Look for script tasks with variable operations
      const scriptTasks = process['bpmn2:scriptTask'];
      if (scriptTasks) {
        const scriptTaskArray = Array.isArray(scriptTasks) ? scriptTasks : [scriptTasks];
        
        scriptTaskArray.forEach(task => {
          const taskProps = task['bpmn2:extensionElements']?.['ifl:property'] || [];
          const propsArray = Array.isArray(taskProps) ? taskProps : [taskProps].filter(Boolean);
          
          // Check for variable operations
          const hasVariables = propsArray.some(prop => 
            prop.key?._.toLowerCase().includes('variable') ||
            prop.key?._.toLowerCase().includes('header') ||
            prop.key?._.toLowerCase().includes('property')
          );
          
          // Check the script content for variable operations
          const script = task['bpmn2:script'];
          let hasVariableInScript = false;
          if (script && typeof script === 'string') {
            hasVariableInScript = script.includes('setProperty') || 
                                script.includes('getProperty') ||
                                script.includes('setHeader') ||
                                script.includes('getHeader');
          }
          
          if (hasVariables || hasVariableInScript) {
            const operation = this.determineVariableOperation(propsArray, script);
            variableOperations.push({
              id: task.id || 'UnknownTask',
              name: task.name || 'Variable Operation',
              type: 'ScriptTask',
              operation: operation
            });
          }
        });
      }

      // Look for content modifier tasks
      const serviceTasks = process['bpmn2:serviceTask'];
      if (serviceTasks) {
        const serviceTaskArray = Array.isArray(serviceTasks) ? serviceTasks : [serviceTasks];
        
        serviceTaskArray.forEach(task => {
          const taskProps = task['bpmn2:extensionElements']?.['ifl:property'] || [];
          const propsArray = Array.isArray(taskProps) ? taskProps : [taskProps].filter(Boolean);
          
          const activityType = propsArray.find(prop => prop.key?._ === 'activityType')?.value?._;
          
          if (activityType && (activityType.includes('ContentModifier') || activityType.includes('Variable'))) {
            variableOperations.push({
              id: task.id || 'UnknownTask',
              name: task.name || 'Content Modifier',
              type: 'ServiceTask',
              operation: activityType
            });
          }
        });
      }

    } catch (error) {
      logger.error('Error finding variable operations', { 
        flowId, 
        error: error.message 
      });
    }

    return variableOperations;
  }

  /**
   * Find external calls in a process
   * @param {Object} process - Process object
   * @param {string} flowId - Flow ID for logging
   * @returns {Array} Array of external calls
   */
  findExternalCalls(process, flowId) {
    const externalCalls = [];
    
    try {
      // Look for call activities
      const callActivities = process['bpmn2:callActivity'];
      if (callActivities) {
        const callActivityArray = Array.isArray(callActivities) ? callActivities : [callActivities];
        
        callActivityArray.forEach(activity => {
          const calledElement = activity.calledElement;
          if (calledElement) {
            externalCalls.push({
              id: activity.id || 'UnknownCall',
              name: activity.name || calledElement,
              calledElement: calledElement
            });
          }
        });
      }

      // Look for service tasks that make external calls
      const serviceTasks = process['bpmn2:serviceTask'];
      if (serviceTasks) {
        const serviceTaskArray = Array.isArray(serviceTasks) ? serviceTasks : [serviceTasks];
        
        serviceTaskArray.forEach(task => {
          const taskProps = task['bpmn2:extensionElements']?.['ifl:property'] || [];
          const propsArray = Array.isArray(taskProps) ? taskProps : [taskProps].filter(Boolean);
          
          const activityType = propsArray.find(prop => prop.key?._ === 'activityType')?.value?._;
          
          if (activityType && (activityType.includes('External') || activityType.includes('Request Reply'))) {
            externalCalls.push({
              id: task.id || 'UnknownTask',
              name: task.name || 'External Call',
              activityType: activityType
            });
          }
        });
      }

    } catch (error) {
      logger.error('Error finding external calls', { 
        flowId, 
        error: error.message 
      });
    }

    return externalCalls;
  }

  /**
   * Extract JMS configuration from adapter properties
   * @param {Array} properties - Properties array
   * @param {string} adapterName - Adapter name
   * @returns {Object|null} JMS configuration
   */
  extractJMSConfiguration(properties, adapterName) {
    const jmsProperties = {};
    
    properties.forEach(prop => {
      if (prop.key && prop.key._) {
        const key = prop.key._;
        const value = prop.value ? prop.value._ : '';
        
        // Collect JMS-related properties
        if (key.toLowerCase().includes('jms') || 
            key.toLowerCase().includes('queue') || 
            key.toLowerCase().includes('topic')) {
          jmsProperties[key] = value;
        }
      }
    });
    
    // Check if we have meaningful JMS configuration
    if (Object.keys(jmsProperties).length > 0) {
      return {
        name: adapterName,
        type: 'JMS',
        properties: jmsProperties
      };
    }
    
    return null;
  }

  /**
   * Extract message persistence configuration
   * @param {Array} properties - Properties array
   * @param {string} adapterName - Adapter name
   * @param {string} componentType - Component type
   * @returns {Object|null} Message persistence configuration
   */
  extractMessagePersistenceConfiguration(properties, adapterName, componentType) {
    let hasPersistence = false;
    const persistenceConfig = {};
    
    properties.forEach(prop => {
      if (prop.key && prop.key._) {
        const key = prop.key._;
        const value = prop.value ? prop.value._ : '';
        
        // Check for persistence-related properties
        if (key.toLowerCase().includes('persist') || 
            key.toLowerCase().includes('durable') || 
            key.toLowerCase().includes('reliable')) {
          hasPersistence = true;
          persistenceConfig[key] = value;
        }
      }
    });
    
    // Check component type for persistence indicators
    if (componentType.toLowerCase().includes('jms') || 
        componentType.toLowerCase().includes('queue') ||
        componentType.toLowerCase().includes('reliable')) {
      hasPersistence = true;
    }
    
    if (hasPersistence) {
      return {
        adapterName: adapterName,
        componentType: componentType,
        enabled: true,
        configuration: persistenceConfig
      };
    }
    
    return null;
  }

  /**
   * Extract data store configuration
   * @param {Array} properties - Properties array
   * @param {string} adapterName - Adapter name
   * @param {string} componentType - Component type
   * @returns {Object|null} Data store configuration
   */
  extractDataStoreConfiguration(properties, adapterName, componentType) {
    let hasDataStore = false;
    const dataStoreConfig = {};
    let operation = 'Unknown';
    
    properties.forEach(prop => {
      if (prop.key && prop.key._) {
        const key = prop.key._;
        const value = prop.value ? prop.value._ : '';
        
        // Check for data store related properties
        if (key.toLowerCase().includes('datastore') || 
            key.toLowerCase().includes('data_store') ||
            key.toLowerCase().includes('store')) {
          hasDataStore = true;
          dataStoreConfig[key] = value;
          
          // Try to determine operation type
          if (key.toLowerCase().includes('get') || key.toLowerCase().includes('select')) {
            operation = 'Get';
          } else if (key.toLowerCase().includes('put') || key.toLowerCase().includes('write')) {
            operation = 'Put';
          } else if (key.toLowerCase().includes('delete')) {
            operation = 'Delete';
          }
        }
      }
    });
    
    // Check component type for data store indicators
    if (componentType.toLowerCase().includes('datastore') || 
        componentType.toLowerCase().includes('store')) {
      hasDataStore = true;
    }
    
    if (hasDataStore) {
      return {
        adapterName: adapterName,
        componentType: componentType,
        operation: operation,
        enabled: true,
        configuration: dataStoreConfig
      };
    }
    
    return null;
  }

  /**
   * Determine variable operation from properties and script
   * @param {Array} properties - Properties array
   * @param {string} script - Script content
   * @returns {string} Operation type
   */
  determineVariableOperation(properties, script) {
    // Check properties for operation hints
    const operationProp = properties.find(prop => 
      prop.key?._.toLowerCase().includes('operation') ||
      prop.key?._.toLowerCase().includes('action')
    );
    
    if (operationProp && operationProp.value?._) {
      return operationProp.value._;
    }
    
    // Check script for operation patterns
    if (script && typeof script === 'string') {
      if (script.includes('setProperty') || script.includes('setHeader')) {
        return 'Set Variable';
      } else if (script.includes('getProperty') || script.includes('getHeader')) {
        return 'Get Variable';
      } else if (script.includes('removeProperty') || script.includes('removeHeader')) {
        return 'Remove Variable';
      }
    }
    
    return 'Variable Operation';
  }

  /**
   * Merge persistence details
   * @param {Object} persistence - Main persistence object
   * @param {Object} details - Additional persistence details
   */
  mergePersistenceDetails(persistence, details) {
    if (!details) {
      return;
    }

    // Merge JMS adapters
    if (details.jmsAdapters && details.jmsAdapters.length > 0) {
      persistence.jms_enabled = true;
      persistence.persistence_details.jmsAdapters.push(...details.jmsAdapters);
    }

    // Merge message persistence
    if (details.messagePersistence && details.messagePersistence.length > 0) {
      persistence.message_persistence_enabled = true;
      persistence.persistence_details.messagePersistence.push(...details.messagePersistence);
    }

    // Merge data store operations
    if (details.dataStoreOperations && details.dataStoreOperations.length > 0) {
      persistence.data_store_enabled = true;
      persistence.persistence_details.dataStoreOperations.push(...details.dataStoreOperations);
    }

    // Merge data store activities
    if (details.dataStoreActivities && details.dataStoreActivities.length > 0) {
      persistence.data_store_enabled = true;
      persistence.persistence_details.dataStoreActivities.push(...details.dataStoreActivities);
    }

    // Merge variable operations
    if (details.variableOperations && details.variableOperations.length > 0) {
      persistence.variables_enabled = true;
      persistence.persistence_details.variableOperations.push(...details.variableOperations);
    }

    // Merge external calls
    if (details.externalCalls && details.externalCalls.length > 0) {
      persistence.persistence_details.externalCalls.push(...details.externalCalls);
    }

    // Set transactional handling and process type
    if (details.transactionalHandling) {
      persistence.persistence_details.transactionalHandling = details.transactionalHandling;
    }

    if (details.processType) {
      persistence.persistence_details.processType = details.processType;
    }

    if (details.directCall !== undefined) {
      persistence.persistence_details.directCall = details.directCall;
    }
  }
}

module.exports = PersistenceExtractor;