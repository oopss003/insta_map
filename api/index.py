import os
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
from flask import Flask, render_template, request, redirect, url_for, send_from_directory
from werkzeug.utils import secure_filename
from datetime import datetime

# Flask 앱과 템플릿 폴더 위치 설정
app = Flask(__name__, template_folder='../templates')

# Vercel의 쓰기 가능한 임시 폴더
UPLOAD_FOLDER = '/tmp/uploads'
STATIC_FOLDER = '/tmp/static'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(STATIC_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {'csv'}

# (한글 폰트 설정 코드는 여기에 그대로 두시면 됩니다)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- 페이지 라우팅 ---
@app.route('/visualizer')
def index():
    return render_template('index.html')

@app.route('/visualizer/upload', methods=['POST'])
def upload_files():
    files = request.files.getlist('files')
    start_date = request.form.get('start_date')
    end_date = request.form.get('end_date')

    for file in files:
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            file.save(os.path.join(UPLOAD_FOLDER, filename))
            
    return redirect(url_for('analyze', start_date=start_date, end_date=end_date))

@app.route('/visualizer/analyze')
def analyze():
    # 데이터 분석 로직 (이전과 동일)
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    # ... (나머지 분석 코드는 여기에 그대로 두시면 됩니다)
    
    # 예시 결과 데이터
    total_population = 1234
    most_efficient_day = "월요일"
    least_efficient_day = "일요일"
    image_filename = "daily_traffic.png"
    
    # 그래프 생성 및 저장
    plt.figure(figsize=(10, 6))
    # ... (그래프 그리는 코드)
    image_path = os.path.join(STATIC_FOLDER, image_filename)
    plt.savefig(image_path)
    plt.close()

    return render_template('results.html',
                           total_population=total_population,
                           most_efficient_day=most_efficient_day,
                           least_efficient_day=least_efficient_day,
                           image_file=image_filename)

@app.route('/visualizer/images/<filename>')
def serve_image(filename):
    return send_from_directory(STATIC_FOLDER, filename)
