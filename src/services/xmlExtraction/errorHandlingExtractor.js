// services/xmlExtraction/errorHandlingExtractor.js (continued)
const BaseXmlExtractor = require('./baseExtractor');
const logger = require('../../utils/logger');

/**
 * Error handling extraction from iFlow XML
 */
class ErrorHandlingExtractor extends BaseXmlExtractor {
  /**
   * Extract error handling configuration from parsed iFlow XML
   * @param {Object} parsedXml - Parsed XML object
   * @param {string} flowId - Flow ID for logging
   * @returns {Object} Error handling configuration
   */
  extractErrorHandling(parsedXml, flowId) {
    try {
      if (!parsedXml || !parsedXml['bpmn2:definitions']) {
        logger.warn('Invalid or missing parsed XML for error handling extraction', { flowId });
        return this.getDefaultErrorHandling();
      }

      const errorHandling = this.getDefaultErrorHandling();
      
      // Extract error handling from collaboration level
      const collaborationErrorHandling = this.extractCollaborationErrorHandling(parsedXml, flowId);
      Object.assign(errorHandling, collaborationErrorHandling);

      // Extract error handling from processes
      const processErrorHandling = this.extractProcessErrorHandling(parsedXml, flowId);
      this.mergeErrorHandlingDetails(errorHandling, processErrorHandling);

      logger.debug('Error handling extraction completed', { 
        flowId, 
        errorHandling 
      });

      return errorHandling;
    } catch (error) {
      logger.error('Error extracting error handling from XML', { 
        flowId, 
        error: error.message, 
        stack: error.stack 
      });
      return this.getDefaultErrorHandling();
    }
  }

  /**
   * Get default error handling configuration
   * @returns {Object} Default error handling configuration
   */
  getDefaultErrorHandling() {
    return {
      detection_enabled: false,
      logging_enabled: false,
      classification_enabled: false,
      reporting_enabled: false,
      error_handling_details: {}
    };
  }

  /**
   * Extract error handling from collaboration level
   * @param {Object} parsedXml - Parsed XML object
   * @param {string} flowId - Flow ID for logging
   * @returns {Object} Collaboration error handling configuration
   */
  extractCollaborationErrorHandling(parsedXml, flowId) {
    const errorHandling = {};
    const collaborationProps = this.getCollaborationProperties(parsedXml);
    
    collaborationProps.forEach(prop => {
      if (prop && prop.key && prop.key._) {
        const key = prop.key._;
        const value = prop.value ? prop.value._ : '';
        
        // Check for error handling related properties
        if (key === 'returnExceptionToSender') {
          errorHandling.reporting_enabled = value === 'true';
          errorHandling.error_handling_details.returnExceptionToSender = value === 'true';
        }
        
        // Logging level indicates error logging capability
        if (key === 'log') {
          errorHandling.logging_enabled = value !== 'None' && value !== '';
          errorHandling.error_handling_details.logLevel = value;
        }
        
        // Server trace can help with error detection
        if (key === 'ServerTrace') {
          errorHandling.detection_enabled = value === 'true';
          errorHandling.error_handling_details.serverTrace = value === 'true';
        }
      }
    });

    return errorHandling;
  }

  /**
   * Extract error handling from processes
   * @param {Object} parsedXml - Parsed XML object
   * @param {string} flowId - Flow ID for logging
   * @returns {Object} Process error handling details
   */
  extractProcessErrorHandling(parsedXml, flowId) {
    const processDetails = {};
    
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
        
        logger.debug('Processing process for error handling', { 
          flowId, 
          processId, 
          processName 
        });

        // Look for error handling subprocesses
        const errorSubprocesses = this.findErrorSubprocesses(process, flowId);
        if (errorSubprocesses.length > 0) {
          processDetails[processId] = {
            processName: processName,
            errorSubprocesses: errorSubprocesses,
            hasErrorHandling: true
          };
        }

        // Look for try-catch patterns
        const tryCatchPatterns = this.findTryCatchPatterns(process, flowId);
        if (tryCatchPatterns.length > 0) {
          if (!processDetails[processId]) {
            processDetails[processId] = {
              processName: processName,
              hasErrorHandling: true
            };
          }
          processDetails[processId].tryCatchPatterns = tryCatchPatterns;
        }

        // Check for transaction handling
        const transactionInfo = this.extractTransactionInfo(process, flowId);
        if (transactionInfo) {
          if (!processDetails[processId]) {
            processDetails[processId] = {
              processName: processName,
              hasErrorHandling: false
            };
          }
          processDetails[processId].transactionHandling = transactionInfo;
        }
      });

    } catch (error) {
      logger.error('Error extracting process error handling', { 
        flowId, 
        error: error.message 
      });
    }

    return processDetails;
  }

  /**
   * Find error subprocesses in a process
   * @param {Object} process - Process object
   * @param {string} flowId - Flow ID for logging
   * @returns {Array} Array of error subprocess details
   */
  findErrorSubprocesses(process, flowId) {
    const errorSubprocesses = [];
    
    try {
      // Look for subprocesses
      const subProcesses = process['bpmn2:subProcess'];
      if (!subProcesses) {
        return errorSubprocesses;
      }

      const subProcessArray = Array.isArray(subProcesses) ? subProcesses : [subProcesses];
      
      subProcessArray.forEach(subProcess => {
        // Check if it's an error event subprocess
        const activityType = subProcess['bpmn2:extensionElements']?.['ifl:property']?.find(
          prop => prop.key?._ === 'activityType'
        )?.value?._;
        
        if (activityType && activityType.includes('Error')) {
          const subProcessId = subProcess.id || 'UnknownSubProcess';
          const subProcessName = subProcess.name || subProcessId;
          
          // Look for error start events
          const errorStartEvents = this.findErrorStartEvents(subProcess);
          
          errorSubprocesses.push({
            id: subProcessId,
            name: subProcessName,
            type: activityType,
            errorStartEvents: errorStartEvents,
            classification: this.classifyErrorHandling(subProcess)
          });
          
          logger.debug('Found error subprocess', { 
            flowId, 
            subProcessId, 
            subProcessName, 
            activityType 
          });
        }
      });

    } catch (error) {
      logger.error('Error finding error subprocesses', { 
        flowId, 
        error: error.message 
      });
    }

    return errorSubprocesses;
  }

  /**
   * Find error start events in a subprocess
   * @param {Object} subProcess - Subprocess object
   * @returns {Array} Array of error start events
   */
  findErrorStartEvents(subProcess) {
    const errorStartEvents = [];
    
    try {
      const startEvents = subProcess['bpmn2:startEvent'];
      if (!startEvents) {
        return errorStartEvents;
      }

      const startEventArray = Array.isArray(startEvents) ? startEvents : [startEvents];
      
      startEventArray.forEach(startEvent => {
        const errorEventDef = startEvent['bpmn2:errorEventDefinition'];
        if (errorEventDef) {
          errorStartEvents.push({
            id: startEvent.id || 'UnknownErrorEvent',
            name: startEvent.name || 'Error Start Event',
            errorRef: errorEventDef.errorRef || 'UnknownError'
          });
        }
      });

    } catch (error) {
      logger.error('Error finding error start events', { error: error.message });
    }

    return errorStartEvents;
  }

  /**
   * Find try-catch patterns in a process
   * @param {Object} process - Process object
   * @param {string} flowId - Flow ID for logging
   * @returns {Array} Array of try-catch patterns
   */
  findTryCatchPatterns(process, flowId) {
    const tryCatchPatterns = [];
    
    try {
      // Look for service tasks with error handling
      const serviceTasks = process['bpmn2:serviceTask'];
      if (serviceTasks) {
        const serviceTaskArray = Array.isArray(serviceTasks) ? serviceTasks : [serviceTasks];
        
        serviceTaskArray.forEach(task => {
          const taskProps = task['bpmn2:extensionElements']?.['ifl:property'] || [];
          const propsArray = Array.isArray(taskProps) ? taskProps : [taskProps].filter(Boolean);
          
          // Check for error handling properties
          const hasErrorHandling = propsArray.some(prop => 
            prop.key?._.toLowerCase().includes('error') ||
            prop.key?._.toLowerCase().includes('exception') ||
            prop.key?._.toLowerCase().includes('retry')
          );
          
          if (hasErrorHandling) {
            tryCatchPatterns.push({
              id: task.id || 'UnknownTask',
              name: task.name || 'Service Task',
              type: 'ServiceTask',
              errorHandlingProps: propsArray.filter(prop => 
                prop.key?._.toLowerCase().includes('error') ||
                prop.key?._.toLowerCase().includes('exception') ||
                prop.key?._.toLowerCase().includes('retry')
              ).map(prop => ({
                key: prop.key._,
                value: prop.value?._ || ''
              }))
            });
          }
        });
      }

    } catch (error) {
      logger.error('Error finding try-catch patterns', { 
        flowId, 
        error: error.message 
      });
    }

    return tryCatchPatterns;
  }

  /**
   * Extract transaction information from process
   * @param {Object} process - Process object
   * @param {string} flowId - Flow ID for logging
   * @returns {Object|null} Transaction information
   */
  extractTransactionInfo(process, flowId) {
    try {
      const processProps = process['bpmn2:extensionElements']?.['ifl:property'] || [];
      const propsArray = Array.isArray(processProps) ? processProps : [processProps].filter(Boolean);
      
      const transactionTimeout = propsArray.find(prop => prop.key?._ === 'transactionTimeout')?.value?._;
      const transactionalHandling = propsArray.find(prop => prop.key?._ === 'transactionalHandling')?.value?._;
      
      if (transactionTimeout || transactionalHandling) {
        return {
          transactionTimeout: transactionTimeout || 'Not specified',
          transactionalHandling: transactionalHandling || 'Not specified',
          supportsRollback: transactionalHandling === 'Required'
        };
      }

    } catch (error) {
      logger.error('Error extracting transaction info', { 
        flowId, 
        error: error.message 
      });
    }

    return null;
  }

  /**
   * Classify error handling type
   * @param {Object} subProcess - Subprocess object
   * @returns {string} Error handling classification
   */
  classifyErrorHandling(subProcess) {
    try {
      // Look for end events to determine the type of error handling
      const endEvents = subProcess['bpmn2:endEvent'];
      if (!endEvents) {
        return 'Basic';
      }

      const endEventArray = Array.isArray(endEvents) ? endEvents : [endEvents];
      
      // Check if it's a message end event (sends response)
      const hasMessageEnd = endEventArray.some(event => 
        event['bpmn2:messageEventDefinition']
      );
      
      if (hasMessageEnd) {
        return 'Response-based';
      }
      
      // Check if it's an escalation end event
      const hasEscalationEnd = endEventArray.some(event => 
        event['bpmn2:escalationEventDefinition']
      );
      
      if (hasEscalationEnd) {
        return 'Escalation-based';
      }
      
      return 'Standard';

    } catch (error) {
      logger.error('Error classifying error handling', { error: error.message });
      return 'Unknown';
    }
  }

  /**
   * Merge error handling details
   * @param {Object} errorHandling - Main error handling object
   * @param {Object} processDetails - Process error handling details
   */
  mergeErrorHandlingDetails(errorHandling, processDetails) {
    if (Object.keys(processDetails).length > 0) {
      // Enable detection if we found error subprocesses
      const hasErrorSubprocesses = Object.values(processDetails).some(
        process => process.errorSubprocesses && process.errorSubprocesses.length > 0
      );
      
      if (hasErrorSubprocesses) {
        errorHandling.detection_enabled = true;
        errorHandling.classification_enabled = true;
      }
      
      // Enable logging if we found try-catch patterns
      const hasTryCatch = Object.values(processDetails).some(
        process => process.tryCatchPatterns && process.tryCatchPatterns.length > 0
      );
      
      if (hasTryCatch) {
        errorHandling.logging_enabled = true;
      }
      
      // Add process details to error handling details
      errorHandling.error_handling_details.processDetails = processDetails;
    }
  }
}

module.exports = ErrorHandlingExtractor;