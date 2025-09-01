import React, { useState, useEffect } from 'react';
import CameraCapture from '../components/CameraCapture';
import measurementService from '../services/measurementService';

const MeasurementTest = () => {
  const [currentStep, setCurrentStep] = useState('health-check');
  const [healthStatus, setHealthStatus] = useState('checking');
  const [results, setResults] = useState({});

  useEffect(() => {
    checkBackendHealth();
  }, []);

  const checkBackendHealth = async () => {
    try {
      const health = await measurementService.checkHealth();
      setHealthStatus(health.status === 'ok' ? 'connected' : 'error');
      if (health.status === 'ok') {
        setCurrentStep('ready');
      }
    } catch (error) {
      setHealthStatus('error');
      console.error('Backend health check failed:', error);
    }
  };

  const handleCalibrationComplete = (result) => {
    setResults(prev => ({ ...prev, calibration: result }));
    setCurrentStep('measurement');
  };

  const handleMeasurementComplete = async (result) => {
    setResults(prev => ({ ...prev, measurement: result }));
    setCurrentStep('submit');
  };

  const handleSubmit = async () => {
    try {
      const submitResult = await measurementService.submitMeasurements('test-user-' + Date.now());
      setResults(prev => ({ ...prev, submission: submitResult }));
      setCurrentStep('complete');
    } catch (error) {
      console.error('Submission failed:', error);
      alert('Submission failed: ' + error.message);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'health-check':
        return (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <h2>Checking Backend Connection...</h2>
            <div style={{ 
              padding: '20px', 
              backgroundColor: healthStatus === 'connected' ? '#4CAF50' : '#f44336',
              color: 'white',
              borderRadius: '8px',
              margin: '20px 0'
            }}>
              Status: {healthStatus === 'checking' ? 'Connecting...' : 
                      healthStatus === 'connected' ? 'Backend Connected!' : 
                      'Backend Connection Failed'}
            </div>
            {healthStatus === 'error' && (
              <div>
                <p>Make sure your Flask backend is running on localhost:5000</p>
                <button onClick={checkBackendHealth} style={{
                  padding: '10px 20px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}>
                  Retry Connection
                </button>
              </div>
            )}
          </div>
        );

      case 'ready':
        return (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <h2>Measurement System Ready</h2>
            <p>Backend is connected. Ready to start calibration.</p>
            <button 
              onClick={() => setCurrentStep('calibration')}
              style={{
                padding: '15px 30px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              Start Calibration
            </button>
          </div>
        );

      case 'calibration':
        return (
          <div>
            <h2 style={{ textAlign: 'center' }}>Step 1: Calibration</h2>
            <CameraCapture 
              mode="calibration" 
              onComplete={handleCalibrationComplete}
            />
          </div>
        );

      case 'measurement':
        return (
          <div>
            <h2 style={{ textAlign: 'center' }}>Step 2: Measurement</h2>
            <CameraCapture 
              mode="measurement" 
              onComplete={handleMeasurementComplete}
            />
          </div>
        );

      case 'submit':
        return (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <h2>Measurement Complete!</h2>
            <div style={{ 
              backgroundColor: '#f5f5f5', 
              padding: '20px', 
              borderRadius: '8px',
              margin: '20px 0'
            }}>
              <p>Calibration: {results.calibration?.success ? '✅ Success' : '❌ Failed'}</p>
              <p>Measurement: {results.measurement?.success ? '✅ Success' : '❌ Failed'}</p>
            </div>
            <button 
              onClick={handleSubmit}
              style={{
                padding: '15px 30px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              Submit Measurements
            </button>
          </div>
        );

      case 'complete':
        return (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <h2>All Done! ✅</h2>
            <div style={{ 
              backgroundColor: '#4CAF50', 
              color: 'white',
              padding: '20px', 
              borderRadius: '8px',
              margin: '20px 0'
            }}>
              <p>Measurements successfully submitted!</p>
              {results.submission?.measurements && (
                <div style={{ marginTop: '20px', textAlign: 'left' }}>
                  <h4>Final Measurements:</h4>
                  <ul>
                    <li>Shoulder: {results.submission.measurements.shoulder?.toFixed(2)} cm</li>
                    <li>Waist: {results.submission.measurements.waist?.toFixed(2)} cm</li>
                    <li>Torso: {results.submission.measurements.torso?.toFixed(2)} cm</li>
                    <li>Leg: {results.submission.measurements.leg?.toFixed(2)} cm</li>
                    <li>Thigh: {results.submission.measurements.thigh?.toFixed(2)} cm</li>
                  </ul>
                </div>
              )}
            </div>
            <button 
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Start New Measurement
            </button>
          </div>
        );

      default:
        return <div>Unknown step</div>;
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f0f0' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
        <h1 style={{ textAlign: 'center', color: '#333' }}>
          Measurement System Test
        </h1>
        {renderStep()}
      </div>
    </div>
  );
};

export default MeasurementTest;
