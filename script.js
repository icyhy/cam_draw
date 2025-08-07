// 获取DOM元素
const video = document.getElementById('video');
const poseCanvas = document.getElementById('poseCanvas');
const drawingCanvas = document.getElementById('drawingCanvas');
const startBtn = document.getElementById('startBtn');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');
const colorPicker = document.getElementById('colorPicker');
const brushSize = document.getElementById('brushSize');
const brushTypeBtns = document.querySelectorAll('.brush-type-btn');
const statusIndicator = document.getElementById('statusIndicator');
const drawingModeIndicator = document.getElementById('drawingModeIndicator');
// 设置画布上下文
const poseCtx = poseCanvas.getContext('2d');
const drawingCtx = drawingCanvas.getContext('2d');

// 全局变量
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let model = null;
let isModelLoaded = false;
let videoStream = null;
let currentBrushType = 'round';
let isMobile = window.innerWidth <= 768;

// 初始化
function init() {
    // 设置画布尺寸
    setupCanvasSize();
    // 监听窗口大小变化
    window.addEventListener('resize', setupCanvasSize);
    // 绑定事件
    bindEvents();
    // 加载HandPose模型
    loadHandPoseModel();
}

// 设置画布尺寸
function setupCanvasSize() {
    // 检查是否是移动设备
    isMobile = window.innerWidth <= 768;

    // 设置姿态检测画布尺寸
    poseCanvas.width = video.offsetWidth;
    poseCanvas.height = video.offsetHeight;

    // 设置绘画画布尺寸
    const drawingContainer = drawingCanvas.parentElement;
    drawingCanvas.width = drawingContainer.offsetWidth;
    drawingCanvas.height = drawingContainer.offsetHeight;

    // 重置绘画上下文
    resetDrawingContext();
}

// 重置绘画上下文
function resetDrawingContext() {
    drawingCtx.lineCap = 'round';
    drawingCtx.lineJoin = 'round';
    drawingCtx.strokeStyle = colorPicker.value;
    drawingCtx.lineWidth = brushSize.value;
}

// 绑定事件
function bindEvents() {
    // 开始/停止摄像头按钮
    startBtn.addEventListener('click', toggleCamera);

    // 下载按钮
    downloadBtn.addEventListener('click', downloadDrawing);

    // 清除按钮
    clearBtn.addEventListener('click', clearCanvas);

    // 颜色选择器
    colorPicker.addEventListener('input', () => {
        drawingCtx.strokeStyle = colorPicker.value;
    });

    // 画笔粗细
    brushSize.addEventListener('input', () => {
        drawingCtx.lineWidth = brushSize.value;
    });

    // 画笔类型
    brushTypeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 移除所有按钮的active类
            brushTypeBtns.forEach(b => b.classList.remove('active'));
            // 给当前按钮添加active类
            btn.classList.add('active');
            // 更新当前画笔类型
            currentBrushType = btn.dataset.type;
            // 更新画笔样式
            updateBrushStyle();
        });
    });

    // 鼠标/触摸事件（用于测试）
    drawingCanvas.addEventListener('mousedown', startDrawing);
    drawingCanvas.addEventListener('mousemove', draw);
    drawingCanvas.addEventListener('mouseup', stopDrawing);
    drawingCanvas.addEventListener('mouseout', stopDrawing);

    drawingCanvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startDrawing(e.touches[0]);
    });
    drawingCanvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        draw(e.touches[0]);
    });
    drawingCanvas.addEventListener('touchend', stopDrawing);
}

// 更新画笔样式
function updateBrushStyle() {
    switch(currentBrushType) {
        case 'round':
            drawingCtx.lineCap = 'round';
            drawingCtx.lineJoin = 'round';
            break;
        case 'square':
            drawingCtx.lineCap = 'butt';
            drawingCtx.lineJoin = 'miter';
            break;
        case 'line':
            drawingCtx.lineCap = 'butt';
            drawingCtx.lineJoin = 'bevel';
            break;
    }
}

// 加载HandPose模型
async function loadHandPoseModel() {
    try {
        statusIndicator.textContent = '加载模型...';
        statusIndicator.className = 'absolute bottom-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full';

        model = await handpose.load();

        isModelLoaded = true;
        statusIndicator.textContent = '模型已加载，请将手放在摄像头前30-50厘米处';
        statusIndicator.className = 'absolute bottom-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full';
    } catch (error) {
        console.error('模型加载失败:', error);
        statusIndicator.textContent = '模型加载失败';
        statusIndicator.className = 'absolute bottom-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full';
    }
}

// 检测手部姿态
async function detectHandPose() {
    if (!isModelLoaded || !videoStream) return;

    try {
        // 调整参数以优化近距离检测
        const predictions = await model.estimateHands(video, {
            flipHorizontal: true,
            maxContinuousChecks: 5,
            detectionConfidence: 0.7,
            iouThreshold: 0.3
        });

        if (predictions.length > 0) {
            statusIndicator.textContent = '检测到手部姿态';
            statusIndicator.className = 'absolute bottom-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full';
            drawHandPose(predictions[0].landmarks);
            detectPinch(predictions[0].landmarks);
        } else {
            statusIndicator.textContent = '未检测到手部';
            statusIndicator.className = 'absolute bottom-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full';
            clearPoseCanvas();
            isDrawing = false;
        }
    } catch (error) {
        console.error('姿态检测错误:', error);
        statusIndicator.textContent = '检测出错';
        statusIndicator.className = 'absolute bottom-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full';
    }

    // 继续检测
    requestAnimationFrame(detectHandPose);
}

// 清空姿态画布
function clearPoseCanvas() {
    poseCtx.clearRect(0, 0, poseCanvas.width, poseCanvas.height);
}

// 绘制手部姿态
function drawHandPose(landmarks) {
    clearPoseCanvas();
    if (!landmarks || landmarks.length === 0) return;

    // 绘制关键点
    landmarks.forEach(landmark => {
        const x = landmark[0] * (poseCanvas.width / video.videoWidth);
        const y = landmark[1] * (poseCanvas.height / video.videoHeight);
        poseCtx.beginPath();
        poseCtx.arc(x, y, 5, 0, 2 * Math.PI);
        poseCtx.fillStyle = 'green';
        poseCtx.fill();
    });

    // 绘制骨架（连接线）
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4], // 拇指
        [0, 5], [5, 6], [6, 7], [7, 8], // 食指
        [5, 9], [9, 10], [10, 11], [11, 12], // 中指
        [9, 13], [13, 14], [14, 15], [15, 16], // 无名指
        [13, 17], [17, 18], [18, 19], [19, 20]  // 小指
    ];

    connections.forEach(([i1, i2]) => {
        const p1 = landmarks[i1];
        const p2 = landmarks[i2];
        if (p1 && p2) {
            const x1 = p1[0] * (poseCanvas.width / video.videoWidth);
            const y1 = p1[1] * (poseCanvas.height / video.videoHeight);
            const x2 = p2[0] * (poseCanvas.width / video.videoWidth);
            const y2 = p2[1] * (poseCanvas.height / video.videoHeight);

            poseCtx.beginPath();
            poseCtx.moveTo(x1, y1);
            poseCtx.lineTo(x2, y2);
            poseCtx.strokeStyle = 'blue';
            poseCtx.lineWidth = 2;
            poseCtx.stroke();
        }
    });
}

// 切换摄像头
async function toggleCamera() {
    try {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            videoStream = null;
            startBtn.textContent = '开启摄像头';
            statusIndicator.textContent = '摄像头已关闭';
            statusIndicator.className = 'absolute bottom-2 left-2 bg-gray-500 text-white text-xs px-2 py-1 rounded-full';
            isDrawing = false;
            clearPoseCanvas();
        } else {
            startBtn.textContent = '关闭摄像头';
            statusIndicator.textContent = '开启摄像头...';
            statusIndicator.className = 'absolute bottom-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full';

            // 获取用户媒体设备
            videoStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { min: 640, ideal: 1280, max: 1920 },
                    height: { min: 480, ideal: 720, max: 1080 },
                    facingMode: 'user',
                    focusMode: 'continuous',
                    exposureMode: 'continuous'
                }
            });

            video.srcObject = videoStream;
            video.onloadedmetadata = () => {
                video.play();
                statusIndicator.textContent = '摄像头已开启';
                statusIndicator.className = 'absolute bottom-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full';

                // 模型加载完成后开始检测姿态
                if (isModelLoaded) {
                    detectHandPose();
                }
            };
        }
    } catch (error) {
        console.error('摄像头访问失败:', error);
        statusIndicator.textContent = '摄像头访问失败';
        statusIndicator.className = 'absolute bottom-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full';
    }
}

// 停止摄像头
function stopCamera() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
        video.srcObject = null;
    }
}

// 检测拇指和食指捏合
function detectPinch(landmarks) {
    if (!landmarks || landmarks.length < 20) return;

    // 拇指和食指索引 (HandPose模型)
    const thumbIndex = 4;  // 拇指指尖
    const indexFingerIndex = 8;  // 食指指尖

    // 获取拇指和食指关键点
    const thumb = landmarks[thumbIndex];
    const indexFinger = landmarks[indexFingerIndex];

    if (!thumb || !indexFinger) {
        isDrawing = false;
        drawingModeIndicator.textContent = '未激活';
        drawingModeIndicator.className = 'px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-full';
        return;
    }

    // 转换坐标到画布尺寸
    const thumbX = thumb[0] * (drawingCanvas.width / video.videoWidth);
    const thumbY = thumb[1] * (drawingCanvas.height / video.videoHeight);
    const indexX = indexFinger[0] * (drawingCanvas.width / video.videoWidth);
    const indexY = indexFinger[1] * (drawingCanvas.height / video.videoHeight);

    // 计算拇指和食指之间的距离
    const distance = getDistance(
        { x: thumbX, y: thumbY },
        { x: indexX, y: indexY }
    );

    // 捏合检测阈值
    const pinchThreshold = 60;
    const currentX = (thumbX + indexX) / 2;
    const currentY = (thumbY + indexY) / 2;

    // 处理捏合状态
    if (distance < pinchThreshold) {
        drawingModeIndicator.textContent = '已激活';
        drawingModeIndicator.className = 'px-2 py-1 bg-green-500 text-white text-xs rounded-full';

        if (!isDrawing) {
            isDrawing = true;
            lastX = currentX;
            lastY = currentY;
        } else {
            drawLine(lastX, lastY, currentX, currentY);
            lastX = currentX;
            lastY = currentY;
        }
    } else {
        drawingModeIndicator.textContent = '未激活';
        drawingModeIndicator.className = 'px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-full';
        isDrawing = false;
    }
}

// 计算两点之间的距离
function getDistance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// 开始绘画（鼠标/触摸）
function startDrawing(e) {
    isDrawing = true;
    const rect = drawingCanvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
}

// 绘制（鼠标/触摸）
function draw(e) {
    if (!isDrawing) return;
    const rect = drawingCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    drawLine(lastX, lastY, x, y);
    lastX = x;
    lastY = y;
}

// 绘制线条
function drawLine(x1, y1, x2, y2) {
    const ctx = drawingCanvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = colorPicker.value;
    ctx.lineWidth = brushSize.value;
    ctx.lineCap = currentBrushType;
    ctx.stroke();
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', init);

// 停止绘画
function stopDrawing() {
    isDrawing = false;
}

// 清除画布
function clearCanvas() {
    drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
}

// 下载绘画
function downloadDrawing() {
    try {
        // 创建一个临时链接
        const link = document.createElement('a');
        link.download = 'drawing-' + new Date().toISOString().slice(0, 10) + '.png';
        link.href = drawingCanvas.toDataURL('image/png');
        link.click();
    } catch (error) {
        console.error('下载失败:', error);
        alert('下载失败，请重试');
    }
}

// 初始化应用
window.onload = init;