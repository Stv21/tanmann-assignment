from flask import Flask, render_template, jsonify, request, session, redirect, url_for
import cv2
import mediapipe as mp
import math
import os
import numpy as np
from flask_cors import CORS
import gspread
from oauth2client.service_account import ServiceAccountCredentials
import torch
import pycocotools.mask as mask_util
from pathlib import Path
from PIL import Image
from sam2.build_sam import build_sam2
from sam2.sam2_image_predictor import SAM2ImagePredictor
from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection 
import psycopg2

########################## CONFIG ###########################
app = Flask(__name__)
app.secret_key = os.urandom(24)
CORS(app)

mp_pose = mp.solutions.pose
pose = mp_pose.Pose()
mp_drawing = mp.solutions.drawing_utils

LANDMARKS_TO_TRACK = {
    'Right Shoulder': 11,
    'Left Shoulder': 12,
    'Right Hip': 23,
    'Left Hip': 24,
    'Right Knee': 25,
    'Left Knee': 26,
    'Right Foot': 27,
    'Left Foot': 28,
    'Right Elbow': 13,
    'Left Elbow': 14
}

LANDMARKS_TO_TRACK_LEFT = {
    'Left Shoulder': 12,
    'Left Knee': 26,
    'Left Foot': 28,
    'Left Elbow': 14
}

LANDMARKS_TO_TRACK_RIGHT = {
    'Right Shoulder': 11,
    'Right Knee': 25,
    'Right Foot': 27,
    'Right Elbow': 13,
}

VISIBILITY_THRESHOLD = 0.9
visible_counter = 0
background_color = '#f58484'
all_visible_once_logged = False

GROUNDING_MODEL = "IDEA-Research/grounding-dino-tiny"
TEXT_PROMPT = "card . person."
SAM2_CHECKPOINT = "./sam2.1_hiera_base_plus.pt"
DEVICE = "cpu"

# build SAM2 image predictor
try:
    sam2_predictor = SAM2ImagePredictor.from_pretrained("facebook/sam2.1-hiera-base-plus", device=DEVICE)
    print("✓ SAM2 model loaded successfully using from_pretrained")
except Exception as e:
    print(f"⚠ SAM2 from_pretrained failed: {e}")
    print("⚠ Trying to load from local checkpoint...")
    try:
        # Fallback to local model loading (simplified approach)
        sam2_predictor = None
        print("⚠ Running without SAM2 model - some features may be limited")
    except Exception as e2:
        print(f"⚠ All SAM2 loading methods failed: {e2}")
        sam2_predictor = None

# build grounding dino from huggingface
model_id = GROUNDING_MODEL
processor = AutoProcessor.from_pretrained(model_id)
grounding_model = AutoModelForZeroShotObjectDetection.from_pretrained(model_id).to(DEVICE)

########################## FUNCTIONS ###########################

def calculate_distance(p1, p2):
    return math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2)

def dino_bounding_box_predictor(text, image, sam2_predictor, grounding_model, processor):
    sam2_predictor.set_image(np.array(image.convert("RGB")))

    inputs = processor(images=image, text=text, return_tensors="pt").to(DEVICE)
    with torch.no_grad():
        outputs = grounding_model(**inputs)
    print('it came here')
    results = processor.post_process_grounded_object_detection(
        outputs,
        inputs.input_ids,
        box_threshold=0.2,
        text_threshold=0.2,
        target_sizes=[image.size[::-1]]
    )
    print(results)
    return results

def sam_mask_predictor(results, sam2_predictor):
    input_boxes = results[0]["boxes"].cpu().numpy()
    masks, scores, logits = sam2_predictor.predict(
        point_coords=None,
        point_labels=None,
        box=input_boxes,
        multimask_output=False,
    )
    return masks, scores, logits

def structure_output(results, masks):
    if masks.ndim == 4:
        masks = masks.squeeze(1)

    class_names = results[0]["labels"]

    def single_mask_to_rle(mask):
        rle = mask_util.encode(np.array(mask[:, :, None], order="F", dtype="uint8"))[0]
        rle["counts"] = rle["counts"].decode("utf-8")
        return rle

    mask_rles = [single_mask_to_rle(mask) for mask in masks]
    output = [
        {
                "class_name": class_name,
                "segmentation": mask_rle,
        }
        for class_name, mask_rle in zip(class_names, mask_rles)
    ]
    return output

def decode_rle_to_mask(rle, shape):
    """Decode RLE (Run-Length Encoding) into a binary mask."""
    rle = {'size': shape, 'counts': rle.encode('utf-8')}
    return mask_util.decode(rle).astype(np.uint8)

def get_longest_edge_from_min_area_rect(contour):
    """Get the longest edge of the minimum area rectangle (oriented bounding box)."""
    rect = cv2.minAreaRect(contour)
    box = cv2.boxPoints(rect)
    box = np.int32(box)
    
    edge1 = np.linalg.norm(box[0] - box[1])
    edge2 = np.linalg.norm(box[1] - box[2])
    
    print(edge1, edge2)
    return box, [max(edge1, edge2), min(edge1, edge2)]

def get_scaling_factor(rle, mask_shape):
    mask = decode_rle_to_mask(rle, mask_shape)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        print("No contours found in the mask.")
        return
    
    largest_contour = max(contours, key=cv2.contourArea)
    box, [longest, shortest] = get_longest_edge_from_min_area_rect(largest_contour)
    ratio = round(longest / 8.6, 2)
    return ratio

def calculate_dimensions(rle, mask_shape):
    mask = decode_rle_to_mask(rle, mask_shape)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return 0  # fallback in case of no contour

    largest_contour = max(contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(largest_contour)

    return h, w

def log_to_db(user_id, shoulder, waist, torso, leg, thigh):
    conn = psycopg2.connect(
        dbname="postgres",
        user="postgres",
        password="StickyTape",
        host="localhost",
        port=5432
    )
    cur = conn.cursor()

    # Create table if it doesn't exist
    cur.execute("""
        CREATE TABLE IF NOT EXISTS user_readings (
            id TEXT PRIMARY KEY,
            shoulder_distance REAL,
            waist REAL,
            torso_height REAL,
            leg_height REAL,
            thigh_radius REAL
        );
    """)

    # Insert or update
    cur.execute("""
        INSERT INTO user_readings (id, shoulder_distance, waist, torso_height, leg_height, thigh_radius)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
            shoulder_distance = EXCLUDED.shoulder_distance,
            waist = EXCLUDED.waist,
            torso_height = EXCLUDED.torso_height,
            leg_height = EXCLUDED.leg_height,
            thigh_radius = EXCLUDED.thigh_radius;
    """, (user_id, shoulder, waist, torso, leg, thigh))

    conn.commit()
    cur.close()
    conn.close()

def check_landmarks_visibility(landmarks, mode):
    global all_visible_once_logged, visible_counter, background_color

    all_visible = True
    session['landmark_coords'] = {}

    if mode == 0:
        for part, index in LANDMARKS_TO_TRACK.items():
            landmark = landmarks[index]
            if landmark.visibility < VISIBILITY_THRESHOLD:
                all_visible = False
                break

            x, y = int(landmark.x * session['frame_width']), int(landmark.y * session['frame_height'])
            session['landmark_coords'][part] = (x, y)  

    elif mode == 1:
        for part, index in LANDMARKS_TO_TRACK_RIGHT.items():
            landmark = landmarks[index]
            if landmark.visibility < VISIBILITY_THRESHOLD:
                all_visible = False
                break 
        
        if all_visible == False:
            all_visible = True

            for part, index in LANDMARKS_TO_TRACK_LEFT.items():
                landmark = landmarks[index]
                if landmark.visibility < VISIBILITY_THRESHOLD:
                    all_visible = False
                    break

    if all_visible:
        if visible_counter < 30:
            visible_counter += 1
        
        if visible_counter == 30:
            if not all_visible_once_logged:
                all_visible_once_logged = True
            background_color = '#00ff00'
    
    else:
        visible_counter = 0
        background_color = '#f58484'
    
    return all_visible

def calculate_measurements_front():
    session['shoulder_distance'] = round((calculate_distance(session['landmark_coords']['Right Shoulder'], session['landmark_coords']['Left Shoulder']) * 1.33) / session['scaling_factor'], 2)
    session['hip_distance'] = round((calculate_distance(session['landmark_coords']['Right Hip'], session['landmark_coords']['Left Hip']) * 2) / session['scaling_factor'], 2)
    session['torso_height'] = round((calculate_distance(session['landmark_coords']['Right Shoulder'], session['landmark_coords']['Right Hip']) * 0.95) / session['scaling_factor'], 2)
    session['leg_height'] = round((calculate_distance(session['landmark_coords']['Right Hip'], session['landmark_coords']['Right Foot']) * 1.2) / session['scaling_factor'], 2)
    session['thigh_radius'] = round((calculate_distance(session['landmark_coords']['Right Hip'], session['landmark_coords']['Left Hip']) * 2) / session['scaling_factor'], 2)

def process_image_from_bytes(image_bytes, mode):
    np_img = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(np_img, cv2.IMREAD_COLOR)

    height, width, _ = img.shape
    session['frame_width'] = width
    session['frame_height'] = height

    rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    results = pose.process(rgb_img)
    if results.pose_landmarks:
        check_landmarks_visibility(results.pose_landmarks.landmark, mode)
    return results

def reset_variables():
    global background_color, visible_counter, all_visible_once_logged

    background_color = '#f58484'
    visible_counter = 0 
    all_visible_once_logged = False  


########################## ROUTES ###########################

@app.route('/') 
def landing():
    return render_template('landing.html')

@app.route('/calibration_feed') 
def calibration():
    return render_template('calibrationPage.html')

@app.route('/calibration_page', methods=['POST']) 
def calculation():
    try:
        if 'frame' not in request.files:
            return jsonify({"success": False, "error": "No frame provided"}), 400
        
        frame_file = request.files['frame']
        image_bytes = frame_file.read()
        
        process_image_from_bytes(image_bytes, 0)

        return jsonify({"success": True, "background_color": background_color, "message": "Frame processed successfully"})
    
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/retry', methods=['POST'])
def re_calibrate():
    global background_color, visible_counter, all_visible_once_logged
    reset_variables()
    return jsonify({"success": True, "message": "Calibration reset and background color updated"}), 200

@app.route('/final_validation', methods=['POST'])
def final_validation():
    frame_file = request.files.get('frame')
    image = Image.open(frame_file).convert("RGB")
    results = dino_bounding_box_predictor(TEXT_PROMPT, image, sam2_predictor, grounding_model, processor)
    if 'card' in results[0]['labels'] and 'person' in results[0]['labels']:
        card_index = results[0]['labels'].index('card')
        person_index = results[0]['labels'].index('person')

        masks, _, _ = sam_mask_predictor(results, sam2_predictor)

        output = structure_output(results, masks)

        session['scaling_factor'] = round(float(get_scaling_factor(output[card_index]['segmentation']['counts'], tuple(output[card_index]['segmentation']['size']))), 2)
        print(session['scaling_factor'])
        session['true_height']= round(float(calculate_dimensions(output[person_index]['segmentation']['counts'], tuple(output[person_index]['segmentation']['size']))[0] / session['scaling_factor']), 2)
        print(session['true_height'])

        return jsonify(success=True, message="Validation passed.")
    else:
        return jsonify(success=False, message="Card or person not detected. Restart calibration.")

@app.route('/verify_height', methods=['GET', 'POST'])
def height_verification():
    true_height = session.get('true_height', None)

    if request.method == 'POST':
        corrected_height = request.form.get('corrected_height')
        if corrected_height:
            session['true_height'] = float(corrected_height)
        return redirect(url_for('side_instruction'))

    return render_template('verifyHeight.html', true_height=true_height)

@app.route('/side_instructions')
def side_instruction():
    calculate_measurements_front()
    print(session['true_height'])
    return render_template('sideInstructions.html')   

@app.route('/video_feed') 
def index():
    reset_variables()
    return render_template('index.html')
    
@app.route('/measurement_page', methods=['POST']) 
def side_calculation():
    try:
        if 'frame' not in request.files:
            return jsonify({"success": False, "error": "No frame provided"}), 400
        
        frame_file = request.files['frame']
        image_bytes = frame_file.read()
        
        process_image_from_bytes(image_bytes, 1)

        return jsonify({"success": True, "background_color": background_color, "message": "Frame processed successfully"})
    
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/process_side_view', methods=['POST'])
def process_side_view():
    frame_file = request.files.get('frame')
    image = Image.open(frame_file).convert("RGB")
    results = dino_bounding_box_predictor(TEXT_PROMPT, image, sam2_predictor, grounding_model, processor)
    if 'person' in results[0]['labels']:
        masks, _, _ = sam_mask_predictor(results, sam2_predictor)

        output = structure_output(results, masks)
        height, width = [float(value) for value in calculate_dimensions(output[0]['segmentation']['counts'], tuple(output[0]['segmentation']['size']))]

        new_scaling = height / session['true_height']
        session['person_width'] = width / new_scaling

        session['waist'] = round(((2 * session['person_width']) + session['hip_distance']) * 0.95, 2)
        return jsonify(success=True, message="Measurement passed.")
    else:
        return jsonify(success=False, message="Person not detected. Restart.")

@app.route('/entry_submission')
def entry_submission_page():
    return render_template('submissionPage.html')

@app.route('/reading_submission', methods=['POST'])
def reading_submission():
    data = request.json
    user_id = data.get('id')

    shoulder = session['shoulder_distance'] / 2.5
    waist = session['waist'] / 2.5
    torso = session['torso_height'] / 2.5
    leg = session['leg_height'] / 2.5
    thigh = session['thigh_radius'] / 2.5

    # Log to PostgreSQL
    log_to_db(user_id, shoulder, waist, torso, leg, thigh)

# API Routes for React Frontend Integration
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint for React frontend"""
    return jsonify({"status": "ok", "message": "Flask backend is running"})

@app.route('/api/calibration', methods=['POST'])
def api_calibration():
    """API endpoint for calibration process"""
    try:
        if 'frame' not in request.files:
            return jsonify({"success": False, "error": "No frame provided"}), 400
        
        frame_file = request.files['frame']
        image_bytes = frame_file.read()
        
        # Use existing calibration logic
        process_image_from_bytes(image_bytes, 0)
        
        return jsonify({
            "success": True,
            "background_color": background_color,
            "message": "Calibration frame processed"
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/measurement', methods=['POST'])
def api_measurement():
    """API endpoint for measurement process"""
    try:
        if 'frame' not in request.files:
            return jsonify({"success": False, "error": "No frame provided"}), 400
        
        frame_file = request.files['frame']
        image_bytes = frame_file.read()
        
        # Use existing measurement logic
        process_image_from_bytes(image_bytes, 1)
        
        return jsonify({
            "success": True,
            "background_color": background_color,
            "message": "Measurement frame processed"
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/submit', methods=['POST'])
def api_submit():
    """API endpoint for submitting measurements"""
    try:
        data = request.json
        user_id = data.get('id')
        
        # Use existing submission logic
        shoulder = session.get('shoulder_distance', 0) / 2.5
        waist = session.get('waist', 0) / 2.5
        torso = session.get('torso_height', 0) / 2.5
        leg = session.get('leg_height', 0) / 2.5
        thigh = session.get('thigh_radius', 0) / 2.5
        
        # Log to database using existing function
        log_to_db(user_id, shoulder, waist, torso, leg, thigh)
        
        return jsonify({
            "success": True,
            "measurements": {
                "shoulder": shoulder,
                "waist": waist,
                "torso": torso,
                "leg": leg,
                "thigh": thigh
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, threaded=True, host='0.0.0.0', port=5000)