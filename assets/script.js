const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');
const analysisCanvas = document.getElementById('analysisCanvas');
const analysisCtx = analysisCanvas ? analysisCanvas.getContext('2d') : null;
if (analysisCanvas) {
    analysisCanvas.width = canvas.width;
    analysisCanvas.height = canvas.height;
}
const targetCharacterDiv = document.getElementById('targetCharacter');
const feedbackDiv = document.getElementById('feedback');
const scoreDiv = document.getElementById('score');
const resetButton = document.getElementById('resetButton');
const undoButton = document.getElementById('undoButton');
const colorPicker = document.getElementById('colorPicker');
const lineWidth = document.getElementById('lineWidth');
const submitButtonZh = document.getElementById('submitButtonZh');
const submitButtonEn = document.getElementById('submitButtonEn');
const coverageValue = document.getElementById('coverageValue');
const precisionValue = document.getElementById('precisionValue');
const gaugeProgress = document.getElementById('gaugeProgress');
const gaugeLabel = document.getElementById('gaugeLabel');
const toggleOverlayButton = document.getElementById('toggleOverlay');
const analysisSummary = document.getElementById('analysisSummary');
const replayButton = document.getElementById('replayButton');
const bestAccuracyValue = document.getElementById('bestAccuracyValue');
const averageAccuracyValue = document.getElementById('averageAccuracyValue');
const attemptCountValue = document.getElementById('attemptCountValue');
const streakValue = document.getElementById('streakValue');
const sessionStatsContainer = document.getElementById('sessionStats');

let drawing = false;
const strokeHistory = [];
let activeStroke = null;
let lastEvaluation = null;
let overlayVisible = false;
let liveEvaluationScheduled = false;
let isReplaying = false;
let replayAnimationId = null;
let replayTimeoutId = null;
let replayState = null;

const STATS_STORAGE_KEY = 'sir-drawing-practice-stats-v1';
const ACCURACY_STREAK_THRESHOLD = 70;
const REPLAY_STROKE_DELAY = 140;
const REPLAY_DOT_HOLD = 220;
const MIN_REPLAY_SEGMENT_DURATION = 16;

const DEFAULT_SESSION_STATS = {
    attempts: 0,
    totalScore: 0,
    bestScore: 0,
    lastScore: 0,
    currentStreak: 0,
    bestStreak: 0
};

let sessionStats = { ...DEFAULT_SESSION_STATS };

// Initialize canvas settings
ctx.strokeStyle = colorPicker.value;
ctx.lineWidth = lineWidth.value;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

colorPicker.addEventListener('change', () => {
    ctx.strokeStyle = colorPicker.value;
});

lineWidth.addEventListener('change', () => {
    ctx.lineWidth = lineWidth.value;
});

const GAUGE_CIRCUMFERENCE = 2 * Math.PI * 52;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function formatPercentDisplay(value) {
    const number = Number.isFinite(value) ? value : 0;
    const normalized = clamp(number, 0, 100);
    if (Math.abs(normalized - Math.round(normalized)) < 0.05) {
        return `${Math.round(normalized)}%`;
    }
    return `${normalized.toFixed(1)}%`;
}

function loadSessionStats() {
    const defaults = { ...DEFAULT_SESSION_STATS };
    if (typeof localStorage === 'undefined') {
        return { ...defaults };
    }
    try {
        const stored = localStorage.getItem(STATS_STORAGE_KEY);
        if (!stored) {
            return { ...defaults };
        }
        const parsed = JSON.parse(stored);
        return { ...defaults, ...parsed };
    } catch (error) {
        console.warn('Unable to load practice stats:', error);
        return { ...defaults };
    }
}

function saveSessionStats() {
    if (typeof localStorage === 'undefined') {
        return;
    }
    try {
        localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(sessionStats));
    } catch (error) {
        console.warn('Unable to save practice stats:', error);
    }
}

function updateSessionStatsUI() {
    if (!bestAccuracyValue || !averageAccuracyValue || !attemptCountValue || !streakValue) {
        return;
    }

    const attempts = Number(sessionStats.attempts) || 0;
    const average = attempts ? sessionStats.totalScore / attempts : 0;
    const best = clamp(Number(sessionStats.bestScore) || 0, 0, 100);
    const currentStreak = Number(sessionStats.currentStreak) || 0;
    const bestStreak = Number(sessionStats.bestStreak) || 0;

    bestAccuracyValue.textContent = formatPercentDisplay(best);
    averageAccuracyValue.textContent = formatPercentDisplay(average);
    attemptCountValue.textContent = attempts.toString();
    streakValue.textContent = `${currentStreak} / ${bestStreak}`;

    if (sessionStatsContainer) {
        sessionStatsContainer.classList.toggle('is-empty', attempts === 0);
        const placeholders = sessionStatsContainer.querySelectorAll('.session-stats-placeholder');
        placeholders.forEach(node => {
            node.classList.toggle('active', attempts === 0);
        });
    }
}

function recordAttempt(score) {
    const safeScore = clamp(Number(score) || 0, 0, 100);
    sessionStats.attempts += 1;
    sessionStats.totalScore += safeScore;
    sessionStats.lastScore = safeScore;
    sessionStats.bestScore = Math.max(sessionStats.bestScore, safeScore);

    if (safeScore >= ACCURACY_STREAK_THRESHOLD) {
        sessionStats.currentStreak += 1;
        sessionStats.bestStreak = Math.max(sessionStats.bestStreak, sessionStats.currentStreak);
    } else {
        sessionStats.currentStreak = 0;
    }

    saveSessionStats();
    updateSessionStatsUI();
}

function updateReplayButtonLabel() {
    if (!replayButton) return;
    const isEnglish = document.documentElement.lang === 'en';
    const label = replayButton.dataset[isEnglish ? 'labelEn' : 'labelZh'];
    if (label) {
        replayButton.textContent = label;
    }
}

function updateGauge(score) {
    const safeScore = clamp(score, 0, 100);
    const offset = GAUGE_CIRCUMFERENCE * (1 - safeScore / 100);
    gaugeProgress.style.strokeDashoffset = offset.toFixed(2);
    gaugeLabel.textContent = `${Math.round(safeScore)}%`;
}

function updateMetrics({ precision = 0, recall = 0 } = {}) {
    const coveragePercent = Math.round(clamp(recall, 0, 1) * 100);
    const precisionPercent = Math.round(clamp(precision, 0, 1) * 100);
    coverageValue.textContent = `${coveragePercent}%`;
    precisionValue.textContent = `${precisionPercent}%`;
}

function updateScoreText(value = 0) {
    scoreDiv.dataset.score = value;
    const isEnglish = document.documentElement.lang === 'en';
    scoreDiv.textContent = isEnglish ? `Score: ${Math.round(value)}%` : `得分: ${Math.round(value)}%`;
}

function updateAnalysisSummary(evaluation) {
    if (!analysisSummary || !toggleOverlayButton) return;
    if (!evaluation) {
        analysisSummary.textContent = '';
        return;
    }

    const hasInk = strokeHistory.length > 0;
    if (!hasInk) {
        analysisSummary.textContent = '';
        return;
    }

    const missingPercent = evaluation.refPixelCount === 0 ? 0 : (evaluation.missingCount / evaluation.refPixelCount) * 100;
    const extraPercent = evaluation.userPixelCount === 0 ? 0 : (evaluation.extraCount / Math.max(1, evaluation.userPixelCount)) * 100;

    const formatPercent = (value) => {
        if (value === 0) return '0';
        return value >= 10 ? Math.round(value).toString() : value.toFixed(1);
    };

    const missingText = formatPercent(missingPercent);
    const extraText = formatPercent(extraPercent);
    const isEnglish = document.documentElement.lang === 'en';

    if (missingPercent < 1 && extraPercent < 1) {
        analysisSummary.textContent = isEnglish ?
            'Perfect alignment — every stroke matches the guide!' :
            '完美對齊，筆劃完全貼住樣板！';
        return;
    }

    const promptEn = overlayVisible ? toggleOverlayButton.dataset.hideLabelEn : toggleOverlayButton.dataset.labelEn;
    const promptZh = overlayVisible ? toggleOverlayButton.dataset.hideLabelZh : toggleOverlayButton.dataset.labelZh;

    analysisSummary.textContent = isEnglish ?
        `Uncovered guide area: ~${missingText}% · stray ink: ~${extraText}%. Tap “${promptEn}” to inspect.` :
        `未覆蓋樣板：約 ${missingText}% · 多餘線條：約 ${extraText}%。點「${promptZh}」睇提示。`;
}

function updateToggleOverlayLabel() {
    if (!toggleOverlayButton) return;
    const isEnglish = document.documentElement.lang === 'en';
    const showLabel = toggleOverlayButton.dataset[isEnglish ? 'labelEn' : 'labelZh'];
    const hideLabel = toggleOverlayButton.dataset[isEnglish ? 'hideLabelEn' : 'hideLabelZh'];
    toggleOverlayButton.textContent = overlayVisible ? hideLabel : showLabel;
}

function updateOverlayVisibility() {
    if (!analysisCanvas) return;
    analysisCanvas.classList.toggle('visible', overlayVisible);
    updateToggleOverlayLabel();
}

function updateGuidanceAvailability() {
    const hasStrokes = strokeHistory.length > 0;
    if (toggleOverlayButton) {
        toggleOverlayButton.disabled = !hasStrokes || isReplaying;
    }
    if (replayButton) {
        replayButton.disabled = !hasStrokes || isReplaying;
    }
    if (!hasStrokes) {
        overlayVisible = false;
        updateOverlayVisibility();
    }
}

function clearAnalysisOverlay() {
    if (!analysisCtx) return;
    analysisCtx.clearRect(0, 0, analysisCanvas.width, analysisCanvas.height);
}

function renderAnalysisOverlay(evaluation) {
    if (!analysisCtx) return;
    if (!evaluation) {
        clearAnalysisOverlay();
        return;
    }

    const { width, height, refMask, userMask } = evaluation;
    if (analysisCanvas.width !== width || analysisCanvas.height !== height) {
        analysisCanvas.width = width;
        analysisCanvas.height = height;
    }
    const imageData = analysisCtx.createImageData(width, height);
    const data = imageData.data;

    for (let i = 0; i < refMask.length; i++) {
        const ref = refMask[i];
        const user = userMask[i];
        const index = i * 4;

        if (ref && user) {
            data[index] = 46;
            data[index + 1] = 204;
            data[index + 2] = 113;
            data[index + 3] = 180;
        } else if (ref) {
            data[index] = 231;
            data[index + 1] = 76;
            data[index + 2] = 60;
            data[index + 3] = 200;
        } else if (user) {
            data[index] = 52;
            data[index + 1] = 152;
            data[index + 2] = 219;
            data[index + 3] = 180;
        } else {
            data[index + 3] = 0;
        }
    }

    analysisCtx.putImageData(imageData, 0, 0);
}

function setReplayActive(active) {
    isReplaying = active;
    canvas.classList.toggle('is-replaying', active);
    [submitButtonZh, submitButtonEn, undoButton, resetButton].forEach(button => {
        if (!button) return;
        button.disabled = active;
    });

    if (analysisCanvas) {
        analysisCanvas.classList.toggle('replay-hidden', active);
    }

    if (!active) {
        [submitButtonZh, submitButtonEn, undoButton, resetButton].forEach(button => {
            if (!button) return;
            button.disabled = false;
        });
        updateGuidanceAvailability();
    } else {
        if (toggleOverlayButton) {
            toggleOverlayButton.disabled = true;
        }
        if (replayButton) {
            replayButton.disabled = true;
        }
    }
}

function finishReplay({ restore = true } = {}) {
    if (replayAnimationId) {
        cancelAnimationFrame(replayAnimationId);
        replayAnimationId = null;
    }
    if (replayTimeoutId) {
        clearTimeout(replayTimeoutId);
        replayTimeoutId = null;
    }

    if (replayState && replayState.originalStyle) {
        ctx.strokeStyle = replayState.originalStyle.color;
        ctx.lineWidth = replayState.originalStyle.lineWidth;
    }
    replayState = null;

    if (restore) {
        redrawCanvas();
    }

    setReplayActive(false);
}

function cancelReplay({ restore = true } = {}) {
    if (!isReplaying && !replayState) return;
    finishReplay({ restore });
}

function replayDrawing() {
    if (isReplaying || !strokeHistory.length) return;

    const timeline = prepareReplayTimeline();
    replayState = {
        originalStyle: {
            color: ctx.strokeStyle,
            lineWidth: ctx.lineWidth
        },
        timeline,
        strokeIndex: 0,
        lastTimestamp: null
    };

    setReplayActive(true);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const step = (timestamp) => {
        if (!isReplaying || !replayState) {
            return;
        }

        if (replayState.strokeIndex >= replayState.timeline.length) {
            finishReplay({ restore: true });
            return;
        }

        if (replayState.lastTimestamp === null) {
            replayState.lastTimestamp = timestamp;
        }

        let delta = timestamp - replayState.lastTimestamp;
        replayState.lastTimestamp = timestamp;

        while (replayState.strokeIndex < replayState.timeline.length) {
            const stroke = replayState.timeline[replayState.strokeIndex];
            if (!stroke.points || !stroke.points.length) {
                replayState.strokeIndex += 1;
                continue;
            }

            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (stroke.isDot) {
                const point = stroke.points[0];
                ctx.beginPath();
                ctx.arc(point.x, point.y, stroke.width / 2, 0, Math.PI * 2);
                ctx.fillStyle = stroke.color;
                ctx.fill();
                replayState.strokeIndex += 1;
                replayState.lastTimestamp = null;
                replayTimeoutId = setTimeout(() => {
                    replayAnimationId = requestAnimationFrame(step);
                }, REPLAY_STROKE_DELAY + REPLAY_DOT_HOLD);
                return;
            }

            let advancedSegment = false;

            while (stroke.pointIndex < stroke.points.length) {
                const duration = stroke.durations[stroke.pointIndex] || MIN_REPLAY_SEGMENT_DURATION;
                const remaining = duration - stroke.progress;
                const from = stroke.points[stroke.pointIndex - 1];
                const to = stroke.points[stroke.pointIndex];

                if (delta < remaining) {
                    stroke.progress += delta;
                    const t = stroke.progress / duration;
                    const currentX = from.x + (to.x - from.x) * t;
                    const currentY = from.y + (to.y - from.y) * t;
                    ctx.beginPath();
                    ctx.moveTo(from.x, from.y);
                    ctx.lineTo(currentX, currentY);
                    ctx.stroke();
                    replayAnimationId = requestAnimationFrame(step);
                    return;
                }

                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(to.x, to.y);
                ctx.stroke();
                stroke.pointIndex += 1;
                stroke.progress = 0;
                delta -= remaining;
                advancedSegment = true;
            }

            if (stroke.pointIndex >= stroke.points.length) {
                replayState.strokeIndex += 1;
                replayState.lastTimestamp = null;
                replayTimeoutId = setTimeout(() => {
                    replayAnimationId = requestAnimationFrame(step);
                }, REPLAY_STROKE_DELAY);
                return;
            }

            if (!advancedSegment) {
                break;
            }
        }

        finishReplay({ restore: true });
    };

    replayAnimationId = requestAnimationFrame(step);
}

function applyEvaluation(evaluation, { final = false } = {}) {
    if (!evaluation) return;
    lastEvaluation = { ...evaluation };
    updateGauge(evaluation.score);
    updateMetrics(evaluation);
    updateAnalysisSummary(evaluation);

    if (overlayVisible) {
        renderAnalysisOverlay(evaluation);
    } else if (final) {
        // Prepare overlay for when the user opens it later
        renderAnalysisOverlay(evaluation);
    }
}

function scheduleScoreUpdate() {
    if (isReplaying) return;
    if (liveEvaluationScheduled) return;
    liveEvaluationScheduled = true;
    requestAnimationFrame(() => {
        const evaluation = calculateScore();
        applyEvaluation(evaluation, { final: false });
        liveEvaluationScheduled = false;
    });
}

// Set target character
const targetCharacter = `                                                                                       
                  #(                                               
          /%%%%%%&(       (*          *%%######%(               
      %%%%%%%%#,      &%%%%%&   %#%%#%%%%%%#%%%%%%%%            
    %%%%%,           .%%%%%    ##%##            *%%%            
    %%%%%%%,.          %%%&                     #%%%            
       ###%%%#        .%%%*                   #%%#%             
          %%%%,       (%%%         #%&      #%##(               
       %%%%%#         %%%%#,       %#%.   ((%#*                 
    #%###%#       (%%%#%%%&        %%% &%%%%%%%%#%%%%           
                  ,%%%/           *%%#            %%%%,         
         %%&*(%%&%%%%             %#%%           .%%##          
        &%%%% *(&%%%%&            ###%          %%%%%           
       %%%%    %%#&&             ###%       (#####             
       #%%%  &%%%%%              ,###.    /#%###%               
       ##%(  /#%%%%%&.           #%##  /##%##%                  
      ##%%       /%%%%&%         %##%,####*                     
      #%#    %#%&        (%#%%%%%%%#%                           
      .      %%%%%%##%######%%#  %##%                           
          (%%%%%%%##%##          ####                           
   .%#%##%%%#%%%%                ###(                           
&%%%%%##%#%. %%%%%%               .###/                           
%%%%%%%%%%%%.    *%%%%%%%&%%%%%%#.       ,###*                           
,#%%%%%%        .%%%##%%%%*   #%%%%%%%(   /###.                           
     %%%%%  %#%#         %%%%.  (###.                           
            &%%%.               %#%#                            
             %%#                %###                            
`;
targetCharacterDiv.innerHTML = `<pre>${targetCharacter}</pre>`;

function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (evt.clientX - rect.left) * scaleX,
        y: (evt.clientY - rect.top) * scaleY
    };
}

function getTouchPos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (evt.touches[0].clientX - rect.left) * scaleX,
        y: (evt.touches[0].clientY - rect.top) * scaleY
    };
}

function startStrokeAt(position) {
    drawing = true;
    const startTime = performance.now();
    activeStroke = {
        color: ctx.strokeStyle,
        width: Number(ctx.lineWidth) || 1,
        startTime,
        points: [{ x: position.x, y: position.y, time: 0 }]
    };
}

function appendStrokePoint(position) {
    if (!activeStroke) return;
    const now = performance.now();
    const elapsed = now - activeStroke.startTime;
    activeStroke.points.push({ x: position.x, y: position.y, time: elapsed });
    const smoothedPoints = smoothStrokePoints(activeStroke.points);
    redrawCanvas();
    renderStroke(ctx, {
        color: activeStroke.color,
        width: activeStroke.width,
        points: smoothedPoints
    });
}

function finalizeStroke() {
    if (!activeStroke || !activeStroke.points.length) {
        activeStroke = null;
        drawing = false;
        return;
    }

    const smoothedPoints = smoothStrokePoints(activeStroke.points);
    const normalizedPoints = smoothedPoints.map(point => ({
        x: point.x,
        y: point.y,
        time: point.time ?? 0
    }));

    const strokeEntry = {
        color: activeStroke.color,
        width: activeStroke.width,
        points: normalizedPoints,
        isDot: normalizedPoints.length === 1
    };

    strokeHistory.push(strokeEntry);
    redrawCanvas();
    drawing = false;
    activeStroke = null;
    if (strokeHistory.length) {
        scheduleScoreUpdate();
    }
    updateGuidanceAvailability();
}

function startDrawing(e) {
    if (isReplaying) {
        cancelReplay();
    }
    const pos = getMousePos(canvas, e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    startStrokeAt(pos);
}

function smoothStrokePoints(points) {
    if (points.length < 3) {
        return points.map(point => ({ ...point }));
    }

    const smoothed = [];
    smoothed.push({ ...points[0] });

    for (let i = 1; i < points.length - 1; i++) {
        const prevPoint = points[i - 1];
        const currentPoint = points[i];
        const nextPoint = points[i + 1];

        const smoothedX = currentPoint.x + smoothingFactor * (
            (prevPoint.x + nextPoint.x) / 2 - currentPoint.x
        );
        const smoothedY = currentPoint.y + smoothingFactor * (
            (prevPoint.y + nextPoint.y) / 2 - currentPoint.y
        );

        smoothed.push({ x: smoothedX, y: smoothedY, time: currentPoint.time });
    }

    const lastPoint = points[points.length - 1];
    smoothed.push({ ...lastPoint });
    return smoothed;
}

function prepareReplayTimeline() {
    return strokeHistory.map(stroke => {
        const durations = stroke.points.map((point, index) => {
            if (index === 0) return 0;
            const previous = stroke.points[index - 1];
            const prevTime = previous.time ?? 0;
            const currentTime = point.time ?? 0;
            return Math.max(MIN_REPLAY_SEGMENT_DURATION, currentTime - prevTime);
        });

        return {
            color: stroke.color,
            width: stroke.width,
            points: stroke.points.map(point => ({ x: point.x, y: point.y })),
            durations,
            pointIndex: 1,
            progress: 0,
            isDot: stroke.isDot || stroke.points.length === 1
        };
    });
}

function renderStroke(targetCtx, stroke) {
    if (!stroke || !stroke.points || stroke.points.length === 0) return;
    targetCtx.save();
    targetCtx.strokeStyle = stroke.color;
    targetCtx.lineWidth = stroke.width;
    targetCtx.lineCap = 'round';
    targetCtx.lineJoin = 'round';
    if (stroke.points.length === 1) {
        const point = stroke.points[0];
        targetCtx.beginPath();
        targetCtx.arc(point.x, point.y, stroke.width / 2, 0, Math.PI * 2);
        targetCtx.fillStyle = stroke.color;
        targetCtx.fill();
    } else {
        targetCtx.beginPath();
        targetCtx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
            targetCtx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        targetCtx.stroke();
    }
    targetCtx.restore();
}

function redrawCanvas() {
    const activeColor = ctx.strokeStyle;
    const activeWidth = ctx.lineWidth;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokeHistory.forEach(stroke => renderStroke(ctx, stroke));
    ctx.strokeStyle = activeColor;
    ctx.lineWidth = activeWidth;
}

function draw(e) {
    if (!drawing || isReplaying || !activeStroke) return;
    if (e && typeof e.preventDefault === 'function' && e.cancelable) {
        e.preventDefault();
    }

    const pos = e.type.includes('touch') ? getTouchPos(canvas, e) : getMousePos(canvas, e);
    appendStrokePoint(pos);
}

function stopDrawing(e) {
    if (!drawing) return;
    if (e && typeof e.preventDefault === 'function' && e.cancelable) {
        e.preventDefault();
    }
    finalizeStroke();
}

// Add touch event listeners
canvas.addEventListener('touchstart', (e) => {
    if (e.cancelable) {
        e.preventDefault();
    }
    if (isReplaying) {
        cancelReplay();
    }
    const pos = getTouchPos(canvas, e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    startStrokeAt(pos);
});

canvas.addEventListener('touchmove', draw);
canvas.addEventListener('touchend', stopDrawing);
canvas.addEventListener('touchcancel', stopDrawing);

// Keep existing mouse event listeners
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);


function getBoundingBox(points) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    points.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    });
    
    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
}

function getTargetBoundingBox() {
   
    const target = targetCharacterDiv.getBoundingClientRect();
    return {
        x: target.left,
        y: target.top,
        width: target.width,
        height: target.height
    };
}

function provideFeedback(score) {
    const isEnglish = document.documentElement.lang === 'en';
    if (score > 70) {
        feedbackDiv.textContent = isEnglish ?
            "Father-in-law: So 'sir' can be written like this! You learn something new every day!" :
            "親家老爺:原來個sir字都有得寫嘅 真係活到老 學到老 ";
        feedbackDiv.style.color = "#0f766e";
    } else if (score > 50) {
        feedbackDiv.textContent = isEnglish ?
            "Father-in-law: Interesting way to write 'sir'!" :
            "親家老爺:原來個sir字都有得寫嘅 真係活到老 學到老 ";
        feedbackDiv.style.color = "#d97706";
    } else {
        feedbackDiv.textContent = isEnglish ?
            "So you're a police officer! 🔫" :
            "原來你係警察🔫!!！";
        feedbackDiv.style.color = "#dc2626";
    }
}

function showSuccessEffect() {
    const isEnglish = document.documentElement.lang === 'en';
    const successOverlay = document.getElementById('successOverlay');
    const messageOverlay = document.getElementById('messageOverlay');
    const successImage = document.getElementById('successImage');
    const winSound = document.getElementById('winSound');

    // Play win sound
    winSound.currentTime = 0; // Reset sound to start
    winSound.play().catch(err => console.log('Error playing sound:', err));

    successOverlay.classList.add('show');
    messageOverlay.innerHTML = isEnglish ?
        "It turns out that the word sir can be written! Learning never ends! 🤓" :
        "原來個sir字都有得寫嘅 真係活到老 學到老！ 🤓";
    messageOverlay.classList.add('show');
    successImage.style.display = 'block';

    setTimeout(() => {
        successOverlay.classList.remove('show');
        messageOverlay.classList.remove('show');
        successImage.style.display = 'none';
    }, 3000);
}

function showFailureEffect() {
    const isEnglish = document.documentElement.lang === 'en';
    const failOverlay = document.querySelector('.fail-overlay');
    const messageOverlay = document.getElementById('messageOverlay');
    const container = document.querySelector('.container');
    const loseSound = document.getElementById('loseSound');

    // Play lose sound
    loseSound.currentTime = 0; // Reset sound to start
    loseSound.play().catch(err => console.log('Error playing sound:', err));

    failOverlay.classList.add('show');
    messageOverlay.innerHTML = isEnglish ?
        "So you're a police officer! 🔫 😡" :
        "原來你係警察🔫!!！😡";
    messageOverlay.classList.add('show');
    container.classList.add('game-over');

    setTimeout(() => {
        failOverlay.classList.remove('show');
        messageOverlay.classList.remove('show');
        container.classList.remove('game-over');
    }, 3000);
}

function handleSubmit() {
    cancelReplay();
    const evaluation = calculateScore();
    applyEvaluation(evaluation, { final: true });

    const finalScore = evaluation.score;
    updateScoreText(finalScore);
    scoreDiv.classList.add('visible');

    const isEnglish = document.documentElement.lang === 'en';

    if (finalScore < 50) {
        showFailureEffect();
        feedbackDiv.textContent = isEnglish ?
            "So you're a police officer! 🔫" :
            "原來你係警察🔫!!！";
        feedbackDiv.style.color = "#dc2626";
    } else {
        showSuccessEffect();
        provideFeedback(finalScore);
    }

    recordAttempt(finalScore);
}

submitButtonZh.addEventListener('click', handleSubmit);
submitButtonEn.addEventListener('click', handleSubmit);

resetButton.addEventListener('click', () => {
    cancelReplay({ restore: false });
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    activeStroke = null;
    drawing = false;
    strokeHistory.length = 0;
    feedbackDiv.textContent = "";
    scoreDiv.classList.remove('visible');
    const container = document.querySelector('.container');
    container.classList.remove('game-over');
    updateScoreText(0);
    updateGauge(0);
    updateMetrics({ precision: 0, recall: 0 });
    lastEvaluation = null;
    overlayVisible = false;
    updateOverlayVisibility();
    clearAnalysisOverlay();
    updateAnalysisSummary(null);
    updateGuidanceAvailability();
});

undoButton.addEventListener('click', () => {
    cancelReplay();
    if (strokeHistory.length > 0) {
        strokeHistory.pop();
        redrawCanvas();
        if (strokeHistory.length) {
            scheduleScoreUpdate();
        } else {
            updateScoreText(0);
            updateGauge(0);
            updateMetrics({ precision: 0, recall: 0 });
            lastEvaluation = null;
            clearAnalysisOverlay();
            updateAnalysisSummary(null);
        }
    }
    updateGuidanceAvailability();
});

if (toggleOverlayButton) {
    toggleOverlayButton.addEventListener('click', () => {
        if (isReplaying) return;
        if (!overlayVisible && !lastEvaluation && strokeHistory.length) {
            const evaluation = calculateScore();
            applyEvaluation(evaluation, { final: false });
        }

        overlayVisible = !overlayVisible;
        if (overlayVisible) {
            if (lastEvaluation) {
                renderAnalysisOverlay(lastEvaluation);
            } else {
                clearAnalysisOverlay();
            }
        }
        updateOverlayVisibility();
        updateAnalysisSummary(lastEvaluation);
    });
}

if (replayButton) {
    replayButton.addEventListener('click', replayDrawing);
}

function toggleLanguage() {
    const currentLang = document.documentElement.lang;
    const newLang = currentLang === 'en' ? 'zh' : 'en';
    document.documentElement.lang = newLang;
    
    // Toggle active class on language elements
    document.querySelectorAll('[lang]').forEach(el => {
        if (el.getAttribute('lang') === newLang) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });

    // Update score text based on language
    const storedScore = Number(scoreDiv.dataset.score || 0);
    updateScoreText(storedScore);
    updateToggleOverlayLabel();
    updateReplayButtonLabel();
    updateAnalysisSummary(lastEvaluation);
}

// Initialize language
document.addEventListener('DOMContentLoaded', () => {
    const userLang = navigator.language || navigator.userLanguage;
    const initialLang = userLang.startsWith('zh') ? 'zh' : 'en';
    document.documentElement.lang = initialLang;

    // Update initial score text based on language
    updateScoreText(0);
    updateGauge(0);
    updateMetrics({ precision: 0, recall: 0 });
    updateToggleOverlayLabel();
    updateReplayButtonLabel();
    updateGuidanceAvailability();
    updateAnalysisSummary(null);

    document.querySelectorAll(`[lang="${initialLang}"]`).forEach(el => {
        el.classList.add('active');
    });

    try {
        sessionStats = loadSessionStats();
    } catch (error) {
        console.warn('Falling back to default practice stats:', error);
        sessionStats = { ...DEFAULT_SESSION_STATS };
    }
    updateSessionStatsUI();
});

// Replace the calculateScore function with this improved version
function calculateScore() {
    const width = canvas.width;
    const height = canvas.height;
    const totalPixels = width * height;

    const refCanvas = document.createElement('canvas');
    const userCanvas = document.createElement('canvas');
    refCanvas.width = userCanvas.width = width;
    refCanvas.height = userCanvas.height = height;
    const refCtx = refCanvas.getContext('2d');
    const userCtx = userCanvas.getContext('2d');

    refCtx.fillStyle = 'white';
    refCtx.fillRect(0, 0, width, height);
    refCtx.fillStyle = 'black';

    const targetArt = targetCharacterDiv.textContent || '';
    const lines = targetArt.split('\n');
    let minCol = Infinity;
    let maxCol = -Infinity;
    let minRow = Infinity;
    let maxRow = -Infinity;

    lines.forEach((line, row) => {
        for (let col = 0; col < line.length; col++) {
            if (line[col].trim()) {
                minCol = Math.min(minCol, col);
                maxCol = Math.max(maxCol, col);
                minRow = Math.min(minRow, row);
                maxRow = Math.max(maxRow, row);
            }
        }
    });

    if (maxCol === -Infinity) {
        minCol = 0;
        maxCol = lines.reduce((acc, line) => Math.max(acc, line.length), 0);
        minRow = 0;
        maxRow = lines.length;
    }

    const effectiveCols = Math.max(1, maxCol - minCol + 1);
    const effectiveRows = Math.max(1, maxRow - minRow + 1);
    const cellWidth = width / effectiveCols;
    const cellHeight = height / effectiveRows;
    const insetX = (width - cellWidth * effectiveCols) / 2;
    const insetY = (height - cellHeight * effectiveRows) / 2;
    const shrinkRatio = 0.8;
    const fillWidth = Math.max(1, cellWidth * shrinkRatio);
    const fillHeight = Math.max(1, cellHeight * shrinkRatio);
    const offsetX = insetX + (cellWidth - fillWidth) / 2;
    const offsetY = insetY + (cellHeight - fillHeight) / 2;

    lines.forEach((line, row) => {
        for (let col = 0; col < line.length; col++) {
            if (!line[col].trim()) continue;
            const drawX = offsetX + (col - minCol) * cellWidth;
            const drawY = offsetY + (row - minRow) * cellHeight;
            refCtx.fillRect(drawX, drawY, fillWidth, fillHeight);
        }
    });

    userCtx.fillStyle = 'white';
    userCtx.fillRect(0, 0, width, height);
    strokeHistory.forEach(stroke => renderStroke(userCtx, stroke));

    const refData = refCtx.getImageData(0, 0, width, height).data;
    const userData = userCtx.getImageData(0, 0, width, height).data;
    const refMask = new Uint8Array(totalPixels);
    const userMask = new Uint8Array(totalPixels);

    for (let i = 0; i < totalPixels; i++) {
        const pixelIndex = i * 4;
        if (refData[pixelIndex + 3] > 128 && refData[pixelIndex] < 200) {
            refMask[i] = 1;
        }
        if (userData[pixelIndex + 3] > 128 && userData[pixelIndex] < 200) {
            userMask[i] = 1;
        }
    }

    const dilationRadius = 6;
    const dilateMask = (mask) => {
        const dilated = new Uint8Array(mask.length);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                if (!mask[index]) continue;

                for (let dy = -dilationRadius; dy <= dilationRadius; dy++) {
                    const ny = y + dy;
                    if (ny < 0 || ny >= height) continue;
                    for (let dx = -dilationRadius; dx <= dilationRadius; dx++) {
                        if (dx * dx + dy * dy > dilationRadius * dilationRadius) continue;
                        const nx = x + dx;
                        if (nx < 0 || nx >= width) continue;
                        dilated[ny * width + nx] = 1;
                    }
                }
            }
        }
        return dilated;
    };

    const userDilated = dilateMask(userMask);
    const refDilated = dilateMask(refMask);

    let matchedForRecall = 0;
    let matchedForPrecision = 0;
    let refCount = 0;
    let userCount = 0;

    for (let i = 0; i < totalPixels; i++) {
        if (refMask[i]) {
            refCount++;
            if (userDilated[i]) {
                matchedForRecall++;
            }
        }
        if (userMask[i]) {
            userCount++;
            if (refDilated[i]) {
                matchedForPrecision++;
            }
        }
    }

    const recall = refCount === 0 ? 0 : matchedForRecall / refCount;
    const precision = userCount === 0 ? 0 : matchedForPrecision / userCount;
    const f1Score = (precision + recall) === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    const score = Math.round(clamp(f1Score * 100, 0, 100));

    return {
        score,
        precision,
        recall,
        f1Score,
        refMask,
        userMask,
        width,
        height,
        missingCount: Math.max(0, refCount - matchedForRecall),
        extraCount: Math.max(0, userCount - matchedForPrecision),
        refPixelCount: refCount,
        userPixelCount: userCount
    };
}
