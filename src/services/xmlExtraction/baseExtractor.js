// services/xmlExtraction/baseExtractor.js
const logger = require('../../utils/logger');
const xml2js = require('xml2js');
const AdmZip = require('adm-zip');
const fs = require('fs');

/**
 * Base XML extractor with common functionality
 */
class BaseXmlExtractor {
  constructor() {
    this.housekeepingDir = process.env.HOUSEKEEPING_DIR || '/Siva/AI/playground/HouseKeeping';
  }

  /**
   * Parse XML string to JSON
   * @param {string} xml - XML content
   * @returns {Promise<Object>} Parsed JSON
   */
  async parseXml(xml) {
    const parser = new xml2js.Parser({ 
      explicitArray: false,
      mergeAttrs: true, 
      normalizeTags: false,
      ignoreAttrs: false,
      xmlns: true
    });
    
    try {
      const result = await parser.parseStringPromise(xml);
      logger.debug('XML parsed successfully', { topLevelKeys: Object.keys(result) });
      return result;
    } catch (error) {
      logger.error('XML parsing error', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Extract and parse XML from a ZIP file containing an iFlow
   * @param {Buffer} zipBuffer - ZIP file buffer
   * @param {string} flowId - Flow ID for logging and debugging
   * @returns {Promise<Object|null>} Parsed XML object or null on failure
   */
  async extractXmlFromZip(zipBuffer, flowId) {
    try {
      logger.debug('Starting ZIP processing', { flowId, bufferSize: zipBuffer.length });

      const zipPath = `${this.housekeepingDir}/${flowId}.zip`;
      fs.writeFileSync(zipPath, zipBuffer);
      logger.debug('Saved ZIP file', { flowId, path: zipPath });

      // Extract ZIP contents
      let zip;
      try {
        zip = new AdmZip(zipBuffer);
      } catch (zipError) {
        logger.error('Failed to initialize AdmZip', { flowId, error: zipError.message });
        return null;
      }

      const zipEntries = zip.getEntries();
      logger.debug('ZIP contents', { 
        flowId, 
        files: zipEntries.map(e => e.entryName),
        fileCount: zipEntries.length 
      });
      
      // Find .iflw file
      const iflwEntry = zipEntries.find(entry => entry.entryName.endsWith('.iflw'));
      if (!iflwEntry) {
        logger.warn('No .iflw file found in ZIP', { flowId });
        return null;
      }
      
      logger.debug('Found .iflw file', { flowId, iflwFile: iflwEntry.entryName });
      let xmlContent;
      try {
        xmlContent = zip.readAsText(iflwEntry);
      } catch (readError) {
        logger.error('Failed to read .iflw file', { flowId, iflwFile: iflwEntry.entryName, error: readError.message });
        return null;
      }
      
      // Save XML for debugging
      const xmlPath = `${this.housekeepingDir}/${flowId}.iflw`;
      fs.writeFileSync(xmlPath, xmlContent);
      logger.debug('Saved iFlow XML', { flowId, path: xmlPath, xmlSize: xmlContent.length });
      
      // Parse XML
      let parsedXml;
      try {
        parsedXml = await this.parseXml(xmlContent);
      } catch (parseError) {
        logger.error('Failed to parse XML', { flowId, error: parseError.message });
        return null;
      }
      
      // Log parsed XML structure
      const definitions = parsedXml['bpmn2:definitions'];
      const collaboration = definitions?.['bpmn2:collaboration'];
      logger.debug('Parsed XML structure', { 
        flowId, 
        definitionsExists: !!definitions,
        collaborationExists: !!collaboration
      });

      return parsedXml;
    } catch (error) {
      logger.error('Error extracting XML from ZIP', { 
        flowId, 
        error: error.message, 
        stack: error.stack 
      });
      return null;
    }
  }

  /**
   * Get property value by key from properties array
   * @param {Array} propertyArray - Array of properties
   * @param {string} targetKey - Key to find
   * @returns {string} Property value or empty string
   */
  getPropertyValue(propertyArray, targetKey) {
    const property = propertyArray.find(prop => {
      if (prop.key && prop.key._ === targetKey) {
        return true;
      }
      return false;
    });
    
    if (property && property.value) {
      return property.value._ || '';
    }
    return '';
  }

  /**
   * Get message flows from parsed XML
   * @param {Object} parsedXml - Parsed XML object
   * @returns {Array} Array of message flows
   */
  getMessageFlows(parsedXml) {
    if (!parsedXml || !parsedXml['bpmn2:definitions']) {
      return [];
    }

    const collaboration = parsedXml['bpmn2:definitions']['bpmn2:collaboration'];
    if (!collaboration) {
      return [];
    }

    let messageFlows = collaboration['bpmn2:messageFlow'] || [];
    if (!Array.isArray(messageFlows)) {
      messageFlows = messageFlows ? [messageFlows] : [];
    }

    return messageFlows;
  }

  /**
   * Get collaboration properties from parsed XML
   * @param {Object} parsedXml - Parsed XML object
   * @returns {Array} Array of collaboration properties
   */
  getCollaborationProperties(parsedXml) {
    if (!parsedXml || !parsedXml['bpmn2:definitions']) {
      return [];
    }

    const collaboration = parsedXml['bpmn2:definitions']['bpmn2:collaboration'];
    if (!collaboration || !collaboration['bpmn2:extensionElements']) {
      return [];
    }

    const properties = collaboration['bpmn2:extensionElements']['ifl:property'] || [];
    return Array.isArray(properties) ? properties : [properties].filter(Boolean);
  }
}

module.exports = BaseXmlExtractor;