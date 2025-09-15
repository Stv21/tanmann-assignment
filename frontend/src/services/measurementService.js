// Production-grade Measurement API service
// Handles all communication with the original company backend for body measurements

import { buildMeasurementUrl, logger } from '../config/environment.js';

/**
 * Measurement Service Class
 * Provides a clean interface for measurement-related API calls using the original company backend
 */
class MeasurementService {
  constructor() {
    this.defaultHeaders = {
      'Content-Type': 'application/json'
    };
  }

  /**
   * Health check endpoint to verify backend connectivity
   * @returns {Promise<Object>} Health status response
   */
  async checkHealth() {
    try {
      // For production backend, check if root endpoint is responding
  const url = buildMeasurementUrl('/');
      logger.debug('Checking production backend health at:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.defaultHeaders,
      });
      
      if (response.ok) {
        return {
          status: 'ok',
          message: 'Production backend is running',
          timestamp: new Date().toISOString(),
          backend: 'Google Cloud Run'
        };
      } else {
        // Try alternative health endpoints
        const healthEndpoints = ['/health', '/api/health', '/status'];
        
        for (const endpoint of healthEndpoints) {
          try {
    const healthUrl = buildMeasurementUrl(endpoint);
            const healthResponse = await fetch(healthUrl, {
              method: 'GET',
              headers: this.defaultHeaders,
            });
            
            if (healthResponse.ok) {
              return {
                status: 'ok',
                message: 'Production backend is running',
                timestamp: new Date().toISOString(),
                endpoint: endpoint
              };
            }
          } catch (error) {
            // Continue to next endpoint
            continue;
          }
        }
        
        throw new Error(`Health check failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Health check failed:', error);
      throw new Error(`Backend connectivity issue: ${error.message}`);
    }
  }

  /**
   * Process calibration frame for front-view measurement setup
   * @param {Blob} frameBlob - Camera frame as blob
   * @returns {Promise<Object>} Calibration processing result
   */
  async processCalibrationFrame(frameBlob) {
    if (!frameBlob) {
      throw new Error('Frame blob is required for calibration');
    }

    try {
      const formData = new FormData();
      formData.append('frame', frameBlob, 'calibration_frame.jpg');
      
      const response = await fetch(buildMeasurementUrl('/api/calibration'), {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Calibration failed`);
      }
      
      const result = await response.json();
      
      // Validate response structure
      if (!result.hasOwnProperty('success')) {
        throw new Error('Invalid response format from calibration endpoint');
      }
      
      return result;
    } catch (error) {
      console.error('Calibration frame processing failed:', error);
      throw new Error(`Calibration error: ${error.message}`);
    }
  }

  /**
   * Process measurement frame for side-view body measurements
   * @param {Blob} frameBlob - Camera frame as blob
   * @returns {Promise<Object>} Measurement processing result
   */
  async processMeasurementFrame(frameBlob) {
    if (!frameBlob) {
      throw new Error('Frame blob is required for measurement');
    }

    try {
      const formData = new FormData();
      formData.append('frame', frameBlob, 'measurement_frame.jpg');
      
      const response = await fetch(buildMeasurementUrl('/api/measurement'), {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Measurement failed`);
      }
      
      const result = await response.json();
      
      // Validate response structure
      if (!result.hasOwnProperty('success')) {
        throw new Error('Invalid response format from measurement endpoint');
      }
      
      return result;
    } catch (error) {
      console.error('Measurement frame processing failed:', error);
      throw new Error(`Measurement error: ${error.message}`);
    }
  }

  /**
   * Submit final measurements and save to database
   * @param {string} userId - User identifier
   * @param {Object} additionalData - Additional measurement data (optional)
   * @returns {Promise<Object>} Submission result with final measurements
   */
  async submitMeasurements(userId, additionalData = {}) {
    if (!userId) {
      throw new Error('User ID is required for measurement submission');
    }

    try {
      const payload = {
        id: userId,
        timestamp: new Date().toISOString(),
        ...additionalData
      };

      const response = await fetch(buildMeasurementUrl('/api/submit'), {
        method: 'POST',
        headers: this.defaultHeaders,
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Submission failed`);
      }
      
      const result = await response.json();
      
      // Validate response structure
      if (!result.hasOwnProperty('success')) {
        throw new Error('Invalid response format from submission endpoint');
      }
      
      return result;
    } catch (error) {
      console.error('Measurement submission failed:', error);
      throw new Error(`Submission error: ${error.message}`);
    }
  }

  /**
   * Get current backend configuration
   * @returns {Object} Current service configuration
   */
  getConfig() {
    return {
      apiUrl: this.apiUrl,
      isProduction: !this.apiUrl.includes('localhost'),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Test complete measurement flow
   * @returns {Promise<Object>} Test results
   */
  async testMeasurementFlow() {
    try {
      const health = await this.checkHealth();
      return {
        success: true,
        health,
        config: this.getConfig(),
        message: 'Measurement service is ready'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        config: this.getConfig()
      };
    }
  }
}

// Export singleton instance for consistent usage across the app
export const measurementService = new MeasurementService();

// Export class for testing or custom instances
export { MeasurementService };

// Default export for convenience
export default measurementService;
