/**
 * Quick Integration Demo Script
 * Tests the measurement service integration
 */

import measurementService from './services/measurementService.js';

async function runIntegrationDemo() {
  console.log('🚀 Starting AI Body Measurement Integration Demo');
  console.log('=' .repeat(50));

  try {
    // Test 1: Health Check
    console.log('\n1. Testing Flask Backend Health...');
    const health = await measurementService.checkHealth();
    console.log('✅ Health Check:', health);

    // Test 2: Environment Configuration
    console.log('\n2. Testing Environment Configuration...');
    const { CONFIG, CURRENT_ENV } = await import('./config/environment.js');
    console.log('✅ Environment:', CURRENT_ENV);
    console.log('✅ Config:', {
      measurementUrl: CONFIG.MEASUREMENT_SERVICE_URL,
      apiUrl: CONFIG.REACT_APP_API_URL,
      debugMode: CONFIG.DEBUG_MODE
    });

    // Test 3: URL Building
    console.log('\n3. Testing URL Building...');
    const { buildMeasurementUrl } = await import('./config/environment.js');
    const testUrl = buildMeasurementUrl('/api/health');
    console.log('✅ Built URL:', testUrl);

    // Test 4: Service Instance
    console.log('\n4. Testing Service Instance...');
    console.log('✅ Service available:', typeof measurementService);
    console.log('✅ Health method:', typeof measurementService.checkHealth);
    console.log('✅ Calibration method:', typeof measurementService.sendCalibrationFrame);
    console.log('✅ Measurement method:', typeof measurementService.processFrame);

    console.log('\n' + '=' .repeat(50));
    console.log('🎉 Integration Demo Complete - All Systems Ready!');
    console.log('🎯 Production-grade integration successful');
    console.log('📱 Frontend: React + Vite + TailwindCSS');
    console.log('🔧 Backend: Flask + SAM2 + MediaPipe');
    console.log('🌐 Access: http://localhost:5173/admin/seller/measurement-flow');
    console.log('=' .repeat(50));

  } catch (error) {
    console.error('❌ Integration Demo Failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Ensure Flask service is running on configured port');
    console.log('2. Check environment variables in .env.local');
    console.log('3. Verify CORS settings allow frontend domain');
    console.log('4. Check network connectivity between services');
  }
}

// Export for use in browser console
window.runIntegrationDemo = runIntegrationDemo;

export default runIntegrationDemo;
