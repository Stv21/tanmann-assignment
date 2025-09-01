import { useEffect, useState, useRef } from "react";
import measurementService from "../../../services/measurementService";

export default function CalibrationPage({ onCalibrationComplete, embedded = false }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(document.createElement("canvas"));
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState('#f58484');
  const [status, setStatus] = useState('Initializing camera...');
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);

  useEffect(() => {
    initializeCamera();
    testBackendConnection();
  }, []);

  const testBackendConnection = async () => {
    try {
      const health = await measurementService.checkHealth();
      console.log('Backend connection successful:', health);
      setStatus('Camera ready. Please position yourself for calibration.');
    } catch (error) {
      console.error('Backend connection failed:', error);
      setError(`Backend connection failed: ${error.message}`);
      setStatus('Backend connection error');
    }
  };

  const initializeCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user'
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStatus('Camera ready. Click "Start Calibration" to begin.');
        setError(null);
      }
    } catch (err) {
      console.error("Error accessing webcam:", err);
      setError("Could not access the webcam. Please allow camera access.");
      setStatus('Camera access denied');
    }
  };

  const captureAndSendFrame = async () => {
    if (isCalibrated || !videoRef.current || isProcessing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    
    // Ensure canvas dimensions match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        console.error("Failed to create blob from canvas");
        return;
      }

      setIsProcessing(true);
      
      try {
        const result = await measurementService.processCalibrationFrame(blob);
        
        if (result.success) {
          const newBgColor = result.background_color || '#f58484';
          setBackgroundColor(newBgColor);
          document.body.style.backgroundColor = newBgColor;
          
          if (newBgColor === '#00ff00') {
            setIsCalibrated(true);
            setStatus('Calibration complete! Perfect positioning detected.');
            setError(null);
            
            // Call completion callback if provided (for embedded mode)
            if (onCalibrationComplete) {
              onCalibrationComplete({ success: true, calibrated: true });
            }
          } else {
            setStatus('Calibrating... Please ensure full body is visible with credit card.');
          }
        } else {
          setError(result.error || 'Calibration processing failed');
          setStatus('Calibration error occurred');
        }
      } catch (err) {
        console.error("Error sending frame:", err);
        setError(`Frame processing error: ${err.message}`);
        setStatus('Connection error');
      } finally {
        setIsProcessing(false);
      }
    }, "image/jpeg", 0.8);
  };

  const startCalibration = () => {
    if (isCalibrated) return;
    
    setError(null);
    setStatus('Starting calibration...');
    
    // Start continuous frame capture
    const interval = setInterval(() => {
      if (isCalibrated) {
        clearInterval(interval);
        return;
      }
      captureAndSendFrame();
    }, 100); // Capture every 100ms

    // Auto-stop after 30 seconds if not calibrated
    setTimeout(() => {
      if (!isCalibrated) {
        clearInterval(interval);
        setStatus('Calibration timeout. Please try again.');
      }
    }, 30000);
  };

  const resetCalibration = () => {
    setIsCalibrated(false);
    setBackgroundColor('#f58484');
    setError(null);
    setStatus('Camera ready. Click "Start Calibration" to begin.');
    document.body.style.backgroundColor = '#f58484';
  };

  useEffect(() => {
    const interval = setInterval(captureAndSendFrame, 1000);
    return () => clearInterval(interval);
  }, [isCalibrated]);

  const handleRecalibrate = async () => {
    document.body.style.backgroundColor = "#f58484";
    setIsCalibrated(false);
    await axios.post(`${backendURL}/re_calibrate`);
  };

  const handleContinue = async () => {
    try {
      const response = await axios.post(`${backendURL}/get_circle_coords`);
      sessionStorage.setItem("circleCoords", JSON.stringify(response.data.coordinates));
      window.location.href = `${backendURL}/video_feed`;
    } catch (err) {
      console.error("Error fetching circle coordinates: ", err);
      alert("Failed to fetch circle coordinates. Please try again.");
    }
  };

  return (
    <div className={embedded ? "p-4" : "min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4"}>
      <div className={embedded ? "w-full" : "max-w-4xl mx-auto"}>
        {/* Header - Hide in embedded mode */}
        {!embedded && (
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">
              Uniform Measurement Calibration
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Position yourself so your shoulders, hips, elbows, hands, and feet are clearly visible in the camera frame for accurate measurements.
            </p>
          </div>
        )}

        {/* Status Card */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Calibration Status</h2>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              isCalibrated ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {isCalibrated ? 'Calibrated' : 'In Progress'}
            </div>
          </div>
          <p className="text-gray-600">{status}</p>
          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Camera Feed */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-col items-center">
            <div 
              className="relative rounded-lg overflow-hidden shadow-lg"
              style={{ backgroundColor: backgroundColor }}
            >
              <video 
                ref={videoRef} 
                autoPlay 
                muted
                playsInline
                className="w-full max-w-md h-auto rounded-lg"
                style={{ minHeight: '400px' }}
              />
              {!isCalibrated && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg">
                    Ensure full body visibility
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex gap-4">
              {!isCalibrated ? (
                <>
                  <button 
                    onClick={startCalibration}
                    disabled={isCalibrating}
                    className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                      isCalibrating
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl'
                    }`}
                  >
                    {isCalibrating ? 'Calibrating...' : 'Start Calibration'}
                  </button>
                  <button 
                    onClick={resetCalibration}
                    className="px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors shadow-lg hover:shadow-xl"
                  >
                    Reset
                  </button>
                </>
              ) : (
                <div className="text-center">
                  <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-center mb-2">
                      <svg className="w-6 h-6 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <h3 className="text-lg font-semibold text-green-800">Calibration Complete!</h3>
                    </div>
                    <p className="text-green-700">Your measurements are ready to be captured.</p>
                  </div>
                  
                  <div className="flex gap-4 justify-center">
                    <button 
                      onClick={handleRecalibrate}
                      className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-lg hover:shadow-xl"
                    >
                      Re-calibrate
                    </button>
                    <button 
                      onClick={handleContinue}
                      className="px-8 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors shadow-lg hover:shadow-xl"
                    >
                      Continue to Measurement
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Instructions Card */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Calibration Instructions</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-start">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5">1</div>
                <div>
                  <h4 className="font-medium text-gray-800">Position Yourself</h4>
                  <p className="text-sm text-gray-600">Stand facing the camera with arms slightly away from your body</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5">2</div>
                <div>
                  <h4 className="font-medium text-gray-800">Full Body Visibility</h4>
                  <p className="text-sm text-gray-600">Ensure your entire body from head to feet is visible</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5">3</div>
                <div>
                  <h4 className="font-medium text-gray-800">Good Lighting</h4>
                  <p className="text-sm text-gray-600">Ensure adequate lighting for clear body landmark detection</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5">4</div>
                <div>
                  <h4 className="font-medium text-gray-800">Stay Still</h4>
                  <p className="text-sm text-gray-600">Remain stationary during the calibration process</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
