import os
import pandas as pd
import matplotlib
matplotlib.use('Agg') # Vercel 환경을 위한 설정
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
from flask import Flask, render_template, request, redirect, url_for, send_from_directory
from werkzeug.utils import secure_filename
from datetime import datetime

# Flask 앱과 템플릿 폴더 위치 설정
app = Flask(__name__, template_folder='../templates')

# Vercel의 쓰기 가능한 임시 폴더
UPLOAD_FOLDER = '/tmp/uploads'
STATIC_FOLDER = '/tmp/static' # 생성된 이미지를 임시 저장할 곳
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(STATIC_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {'csv'}

# (이전과 동일한 한글 폰트 설정 코드)
# ...

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- 페이지 라우팅 ---
@app.route('/')
def index():
    # index.html 파일을 렌더링해서 보여줍니다.
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_files():
    # (이전 코드와 동일: 파일 저장 및 분석 페이지로 리다이렉트)
    files = request.files.getlist('files')
    start_date = request.form.get('start_date')
    end_date = request.form.get('end_date')

    for file in files:
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            file.save(os.path.join(UPLOAD_FOLDER, filename))
            
    return redirect(url_for('analyze', start_date=start_date, end_date=end_date))

@app.route('/analyze')
def analyze():
    # --- 데이터 분석 로직 (이전과 동일) ---
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    start_date = datetime.strptime(start_date_str, '%Y-%m-%d') if start_date_str else None
    end_date = datetime.strptime(end_date_str, '%Y-%m-%d') if end_date_str else None
    
    face_files = [f for f in os.listdir(UPLOAD_FOLDER) if 'face_analysis' in f]
    if not face_files: return "분석할 파일이 없습니다."
    
    # (Pandas 데이터 처리 로직은 이전과 동일...)
    face_data = [pd.read_csv(os.path.join(UPLOAD_FOLDER, f)) for f in face_files]
    face_df = pd.concat(face_data, ignore_index=True)
    # ...
    total_population = face_df['ID'].nunique()
    # ... (요일별 분석 등 나머지 로직)

    # --- 그래프 생성 ---
    plt.figure(figsize=(10, 6))
    # ... (Matplotlib 그래프 그리는 코드)
    image_filename = "daily_traffic.png"
    image_path = os.path.join(STATIC_FOLDER, image_filename)
    plt.savefig(image_path)
    plt.close()
    
    # --- 결과 페이지 렌더링 ---
    # 분석된 데이터와 이미지 파일 이름을 results.html로 전달
    return render_template('results.html',
                           total_population=total_population,
                           most_efficient_day="월요일", # 예시 데이터
                           least_efficient_day="일요일", # 예시 데이터
                           image_file=image_filename)

@app.route('/images/<filename>')
def serve_image(filename):
    # /tmp/static 폴더에서 이미지를 찾아서 웹에 보여줍니다.
    return send_from_directory(STATIC_FOLDER, filename)
