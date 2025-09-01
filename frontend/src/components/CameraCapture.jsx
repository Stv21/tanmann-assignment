import React, { useRef, useEffect, useState } from 'react';
import measurementService from '../services/measurementService';

const CameraCapture = ({ mode = 'measurement', onComplete }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState('#f58484');
  const [status, setStatus] = useState('Starting camera...');
  const [error, setError] = useState(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    let intervalId;
    if (isCapturing) {
      intervalId = setInterval(captureAndProcessFrame, 100); // Every 100ms
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isCapturing, mode]);

  const startCamera = async () => {
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
        setStatus('Camera ready. Click Start to begin.');
        setError(null);
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Camera access denied. Please allow camera permissions.');
      setStatus('Camera error');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
    }
  };

  const captureAndProcessFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);

      canvas.toBlob(async (blob) => {
        if (!blob) return;

        try {
          let result;
          if (mode === 'calibration') {
            result = await measurementService.processCalibrationFrame(blob);
            setStatus('Processing calibration...');
          } else {
            result = await measurementService.processMeasurementFrame(blob);
            setStatus('Processing measurement...');
          }

          if (result.success) {
            setBackgroundColor(result.background_color || '#f58484');
            
            // Green background indicates successful capture
            if (result.background_color === '#00ff00') {
              setIsCapturing(false);
              setStatus('Capture complete! Processing results...');
              if (onComplete) {
                onComplete(result);
              }
            }
          } else {
            setError(result.error || 'Processing failed');
          }
        } catch (err) {
          console.error('Frame processing error:', err);
          setError('Connection to measurement service failed');
        }
      }, 'image/jpeg', 0.8);
    }
  };

  const handleStartCapture = () => {
    setIsCapturing(true);
    setError(null);
    setStatus(`Starting ${mode}...`);
  };

  const handleStopCapture = () => {
    setIsCapturing(false);
    setStatus('Capture stopped');
  };

  return (
    <div className="camera-capture-container" style={{ backgroundColor }}>
      <div className="camera-feed" style={{ padding: '20px', textAlign: 'center' }}>
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline
          style={{ 
            width: '640px', 
            height: '480px', 
            border: '2px solid #333',
            borderRadius: '8px'
          }} 
        />
        <canvas 
          ref={canvasRef} 
          style={{ display: 'none' }} 
        />
        
        <div style={{ marginTop: '20px' }}>
          <div style={{ 
            padding: '10px', 
            marginBottom: '10px',
            backgroundColor: error ? '#ff4444' : '#333',
            color: 'white',
            borderRadius: '4px'
          }}>
            {error || status}
          </div>
          
          <div>
            {!isCapturing ? (
              <button 
                onClick={handleStartCapture}
                disabled={!!error}
                style={{
                  padding: '10px 20px',
                  marginRight: '10px',
                  backgroundColor: error ? '#ccc' : '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: error ? 'not-allowed' : 'pointer'
                }}
              >
                Start {mode === 'calibration' ? 'Calibration' : 'Measurement'}
              </button>
            ) : (
              <button 
                onClick={handleStopCapture}
                style={{
                  padding: '10px 20px',
                  marginRight: '10px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Stop Capture
              </button>
            )}
            
            <button 
              onClick={startCamera}
              style={{
                padding: '10px 20px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Restart Camera
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraCapture;
