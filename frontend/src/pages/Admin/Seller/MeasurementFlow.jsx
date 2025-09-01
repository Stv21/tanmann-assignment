/**
 * Production-grade measurement flow component
 * Integrates calibration and measurement capture with Flask backend
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import measurementService from '../../../services/measurementService';
import CalibrationPage from './CalibrationPage';

const MeasurementFlow = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // State management
  const [currentStep, setCurrentStep] = useState('health-check');
  const [healthStatus, setHealthStatus] = useState('checking');
  const [results, setResults] = useState({});
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(0);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);
  
  // Refs
  const videoRef = useRef(null);
  const progressIntervalRef = useRef(null);

  useEffect(() => {
    // Get user ID from URL params or generate one
    const params = new URLSearchParams(location.search);
    const userIdParam = params.get('userId') || `user-${Date.now()}`;
    setUserId(userIdParam);
    
    // Initialize backend connection
    checkBackendHealth();
    
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [location]);

  /**
   * Check if Flask backend is available
   */
  const checkBackendHealth = async () => {
    try {
      setHealthStatus('checking');
      
      // Debug logging
      console.log('Checking health at:', import.meta.env.VITE_MEASUREMENT_SERVICE_URL || 'http://localhost:5000');
      
      const health = await measurementService.checkHealth();
      
      if (health.status === 'ok') {
        setHealthStatus('connected');
        setCurrentStep('ready');
        console.log('Health check successful:', health);
      } else {
        setHealthStatus('error');
        setError('Backend service is not responding properly');
      }
    } catch (error) {
      setHealthStatus('error');
      setError(`Failed to connect to measurement service: ${error.message}`);
      console.error('Backend health check failed:', error);
    }
  };

  /**
   * Start camera and initialize video feed
   */
  const initializeCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        return stream;
      }
    } catch (error) {
      setError(`Camera access failed: ${error.message}`);
      throw error;
    }
  };

  /**
   * Handle calibration completion
   */
  const handleCalibrationComplete = (result) => {
    setResults(prev => ({ ...prev, calibration: result }));
    setCurrentStep('measurement-setup');
  };

  /**
   * Start measurement capture process
   */
  const startMeasurementCapture = async () => {
    try {
      setIsCapturing(true);
      setCaptureProgress(0);
      setError(null);

      // Initialize camera if not already done
      await initializeCamera();

      // Start progress animation
      progressIntervalRef.current = setInterval(() => {
        setCaptureProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressIntervalRef.current);
            return 100;
          }
          return prev + 2;
        });
      }, 100);

      // Capture measurement frames (simulating 5-second capture)
      setTimeout(async () => {
        try {
          const measurementResult = await measurementService.processFrame(videoRef.current);
          setResults(prev => ({ ...prev, measurement: measurementResult }));
          setCurrentStep('results');
        } catch (error) {
          setError(`Measurement capture failed: ${error.message}`);
        } finally {
          setIsCapturing(false);
          setCaptureProgress(0);
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
          }
        }
      }, 5000);

    } catch (error) {
      setError(`Failed to start measurement: ${error.message}`);
      setIsCapturing(false);
    }
  };

  /**
   * Submit measurements to backend
   */
  const handleSubmitMeasurements = async () => {
    try {
      setCurrentStep('submitting');
      const submitResult = await measurementService.submitMeasurements(userId);
      setResults(prev => ({ ...prev, submission: submitResult }));
      setCurrentStep('complete');
    } catch (error) {
      setError(`Submission failed: ${error.message}`);
      setCurrentStep('results');
    }
  };

  /**
   * Reset and start over
   */
  const handleStartOver = () => {
    setCurrentStep('ready');
    setResults({});
    setError(null);
    setCaptureProgress(0);
    setIsCapturing(false);
  };

  /**
   * Render current step content
   */
  const renderStepContent = () => {
    switch (currentStep) {
      case 'health-check':
        return (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold mb-2">Connecting to Measurement Service</h2>
            <p className="text-gray-600">Please wait while we establish connection...</p>
          </div>
        );

      case 'ready':
        return (
          <div className="text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-2">Ready to Start Measurement</h2>
              <p className="text-gray-600 mb-6">
                The measurement system is ready. Click below to begin the calibration process.
              </p>
            </div>
            <button
              onClick={() => setCurrentStep('calibration')}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-lg"
            >
              Start Calibration
            </button>
          </div>
        );

      case 'calibration':
        return (
          <div>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">Camera Calibration</h2>
              <p className="text-gray-600">
                Position yourself for accurate body measurement detection
              </p>
            </div>
            
            {/* Embed CalibrationPage component directly */}
            <div className="bg-white rounded-lg border border-gray-300 p-4">
              <CalibrationPage 
                onCalibrationComplete={handleCalibrationComplete}
                embedded={true}
              />
            </div>
            
            {/* Manual continue button as fallback */}
            <div className="text-center mt-6">
              <button
                onClick={() => handleCalibrationComplete({ success: true })}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Continue to Measurement
              </button>
            </div>
          </div>
        );

      case 'measurement-setup':
        return (
          <div className="text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-2">Ready for Measurement</h2>
              <p className="text-gray-600 mb-6">
                Calibration complete! Now we'll capture your body measurements automatically.
              </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full max-w-md h-auto rounded-lg mx-auto"
                style={{ minHeight: '300px' }}
              />
            </div>

            <button
              onClick={startMeasurementCapture}
              disabled={isCapturing}
              className={`px-8 py-3 rounded-lg font-medium transition-colors shadow-lg ${
                isCapturing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isCapturing ? 'Capturing Measurements...' : 'Start Measurement Capture'}
            </button>

            {isCapturing && (
              <div className="mt-6">
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-100"
                    style={{ width: `${captureProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600">Analyzing body measurements... {captureProgress}%</p>
              </div>
            )}
          </div>
        );

      case 'results':
        return (
          <div>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-2">Measurement Results</h2>
              <p className="text-gray-600">Your body measurements have been captured successfully</p>
            </div>

            {results.measurement && (
              <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4">Captured Measurements</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {Object.entries(results.measurement).map(([key, value]) => (
                    <div key={key} className="flex justify-between py-2 border-b border-gray-100">
                      <span className="font-medium capitalize">{key.replace('_', ' ')}</span>
                      <span className="text-gray-600">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <button
                onClick={handleStartOver}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                Start Over
              </button>
              <button
                onClick={handleSubmitMeasurements}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-lg"
              >
                Save Measurements
              </button>
            </div>
          </div>
        );

      case 'submitting':
        return (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold mb-2">Saving Measurements</h2>
            <p className="text-gray-600">Please wait while we save your data...</p>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">Measurements Complete!</h2>
            <p className="text-gray-600 mb-6">
              Your body measurements have been successfully captured and saved.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleStartOver}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                New Measurement
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-lg"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            AI-Powered Body Measurement
          </h1>
          <p className="text-lg text-gray-600">
            Accurate measurements using computer vision technology
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            {[
              { key: 'ready', label: 'Setup', icon: '🔧' },
              { key: 'calibration', label: 'Calibration', icon: '📷' },
              { key: 'measurement-setup', label: 'Measurement', icon: '📏' },
              { key: 'results', label: 'Results', icon: '✅' },
            ].map(({ key, label, icon }, index) => (
              <div key={key} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  currentStep === key ? 'bg-blue-600 border-blue-600 text-white' :
                  ['ready', 'calibration', 'measurement-setup', 'results'].indexOf(currentStep) > index
                    ? 'bg-green-600 border-green-600 text-white'
                    : 'bg-gray-200 border-gray-300 text-gray-500'
                }`}>
                  <span className="text-sm">{icon}</span>
                </div>
                <span className={`ml-2 text-sm font-medium ${
                  currentStep === key ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {label}
                </span>
                {index < 3 && <div className="w-8 h-px bg-gray-300 mx-4"></div>}
              </div>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-700">{error}</p>
            </div>
            {healthStatus === 'error' && (
              <button
                onClick={checkBackendHealth}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Retry Connection
              </button>
            )}
          </div>
        )}

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          {renderStepContent()}
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            User ID: {userId} | Measurement Service Status: 
            <span className={`ml-1 font-medium ${
              healthStatus === 'connected' ? 'text-green-600' : 
              healthStatus === 'checking' ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {healthStatus === 'connected' ? 'Connected' : 
               healthStatus === 'checking' ? 'Connecting...' : 'Disconnected'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default MeasurementFlow;
