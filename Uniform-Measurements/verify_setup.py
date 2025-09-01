#!/usr/bin/env python3
"""
Quick verification script to test Flask app setup
"""
import sys
import os

def test_imports():
    """Test if all required packages can be imported"""
    try:
        import flask
        import cv2 
        import numpy
        import torch
        import mediapipe
        import sam2
        print("✓ All core packages imported successfully")
        return True
    except ImportError as e:
        print(f"✗ Import error: {e}")
        return False

def test_model_file():
    """Test if model file exists"""
    model_path = "./sam2.1_hiera_base_plus.pt"
    if os.path.exists(model_path):
        print(f"✓ Model file found: {model_path}")
        return True
    else:
        print(f"✗ Model file not found: {model_path}")
        return False

def test_config_files():
    """Test basic app configuration"""
    try:
        from app import DEVICE, SAM2_CHECKPOINT
        print(f"✓ App config loaded - Device: {DEVICE}")
        print(f"✓ Model checkpoint: {SAM2_CHECKPOINT}")
        return True
    except Exception as e:
        print(f"✗ Config error: {e}")
        return False

if __name__ == "__main__":
    print("=== Flask Backend Verification ===")
    
    all_tests_passed = True
    
    print("\n1. Testing package imports...")
    all_tests_passed &= test_imports()
    
    print("\n2. Testing model file...")
    all_tests_passed &= test_model_file()
    
    print("\n3. Testing app configuration...")
    all_tests_passed &= test_config_files()
    
    print("\n" + "="*40)
    if all_tests_passed:
        print("✓ All tests passed! Flask backend is ready.")
        print("You can now start the app with: python app.py")
    else:
        print("✗ Some tests failed. Please check the errors above.")
        
    print("="*40)
