/**
 * Production-grade environment configuration
 * Manages different environments and API endpoints
 */
console.log('VITE_MEASUREMENT_SERVICE_URL:', import.meta.env.VITE_MEASUREMENT_SERVICE_URL);

// Environment types
export const ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  STAGING: 'staging'
};

// Get current environment
const getCurrentEnvironment = () => {
  if (import.meta.env.MODE === 'production') {
    return ENVIRONMENTS.PRODUCTION;
  } else if (import.meta.env.MODE === 'staging') {
    return ENVIRONMENTS.STAGING;
  }
  return ENVIRONMENTS.DEVELOPMENT;
};

// Environment configuration
const envConfig = {
  [ENVIRONMENTS.DEVELOPMENT]: {
    // Local development URLs (Original Company Backend)
    REACT_APP_API_URL: 'http://localhost:3001',
    MEASUREMENT_SERVICE_URL: import.meta.env.VITE_MEASUREMENT_SERVICE_URL || 'http://localhost:3001',
    DEBUG_MODE: true,
    LOG_LEVEL: 'debug'
  },
  
  [ENVIRONMENTS.STAGING]: {
    // Staging environment URLs
    REACT_APP_API_URL: 'https://staging-api.yourapp.com',
    MEASUREMENT_SERVICE_URL: 'https://staging-measurement.yourapp.com',
    DEBUG_MODE: true,
    LOG_LEVEL: 'info'
  },
  
  [ENVIRONMENTS.PRODUCTION]: {
    // Production URLs
    REACT_APP_API_URL: 'https://api.yourapp.com',
    MEASUREMENT_SERVICE_URL: 'https://measurement.yourapp.com',
    DEBUG_MODE: false,
    LOG_LEVEL: 'error'
  }
};

// Current environment
export const CURRENT_ENV = getCurrentEnvironment();

// Get configuration for current environment
export const getConfig = () => {
  const config = envConfig[CURRENT_ENV];
  
  // Override with environment variables if available
  return {
    ...config,
    REACT_APP_API_URL: import.meta.env.VITE_API_URL || config.REACT_APP_API_URL,
    MEASUREMENT_SERVICE_URL: import.meta.env.VITE_MEASUREMENT_SERVICE_URL || config.MEASUREMENT_SERVICE_URL,
    DEBUG_MODE: import.meta.env.VITE_DEBUG_MODE === 'true' || config.DEBUG_MODE,
  };
};

// Export current config
export const CONFIG = getConfig();

// Utility functions
export const isProduction = () => CURRENT_ENV === ENVIRONMENTS.PRODUCTION;
export const isDevelopment = () => CURRENT_ENV === ENVIRONMENTS.DEVELOPMENT;
export const isStaging = () => CURRENT_ENV === ENVIRONMENTS.STAGING;

// API endpoint builders
export const buildApiUrl = (endpoint) => {
  const baseUrl = CONFIG.REACT_APP_API_URL.replace(/\/$/, '');
  const cleanEndpoint = endpoint.replace(/^\//, '');
  return `${baseUrl}/${cleanEndpoint}`;
};

export const buildMeasurementUrl = (endpoint) => {
  const baseUrl = CONFIG.MEASUREMENT_SERVICE_URL.replace(/\/$/, '');
  const cleanEndpoint = endpoint.replace(/^\//, '');
  return `${baseUrl}/${cleanEndpoint}`;
};

// Logging utility
export const logger = {
  debug: (...args) => {
    if (CONFIG.DEBUG_MODE && ['debug'].includes(CONFIG.LOG_LEVEL)) {
      console.log('[DEBUG]', ...args);
    }
  },
  info: (...args) => {
    if (CONFIG.DEBUG_MODE && ['debug', 'info'].includes(CONFIG.LOG_LEVEL)) {
      console.info('[INFO]', ...args);
    }
  },
  warn: (...args) => {
    if (CONFIG.DEBUG_MODE && ['debug', 'info', 'warn'].includes(CONFIG.LOG_LEVEL)) {
      console.warn('[WARN]', ...args);
    }
  },
  error: (...args) => {
    console.error('[ERROR]', ...args);
  }
};

export default CONFIG;
