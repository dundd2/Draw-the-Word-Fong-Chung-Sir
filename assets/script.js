const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');
const targetCharacterDiv = document.getElementById('targetCharacter');
const feedbackDiv = document.getElementById('feedback');
const scoreDiv = document.getElementById('score');
const resetButton = document.getElementById('resetButton');
const undoButton = document.getElementById('undoButton');
const colorPicker = document.getElementById('colorPicker');
const lineWidth = document.getElementById('lineWidth');
const submitButtonZh = document.getElementById('submitButtonZh');
const submitButtonEn = document.getElementById('submitButtonEn');

let drawing = false;
let points = [];
let lastPoint = null;
const strokeHistory = [];

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

function startDrawing(e) {
    drawing = true;
    points = [];
    const pos = getMousePos(canvas, e);
    lastPoint = pos;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
}

// Add stroke smoothing variables
let smoothedPoints = [];
const smoothingFactor = 0.2;

// Helper function to get touch position
function getTouchPos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (evt.touches[0].clientX - rect.left) * scaleX,
        y: (evt.touches[0].clientY - rect.top) * scaleY
    };
}

// Smoothing function
function smoothPoints(points) {
    if (points.length < 3) return points;
    
    const smoothed = [];
    smoothed.push(points[0]);
    
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
        
        smoothed.push({ x: smoothedX, y: smoothedY });
    }
    
    smoothed.push(points[points.length - 1]);
    return smoothed;
}

// Modified draw function with smoothing
function draw(e) {
    if (!drawing) return;
    e.preventDefault();
    
    const pos = e.type.includes('touch') ? getTouchPos(canvas, e) : getMousePos(canvas, e);
    points.push(pos);
    
    // Apply smoothing if we have enough points
    if (points.length > 2) {
        smoothedPoints = smoothPoints(points);
        
        // Clear the previous line segment
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Redraw all previous strokes
        strokeHistory.forEach(stroke => {
            if (stroke.length > 0) {
                ctx.beginPath();
                ctx.moveTo(stroke[0].x, stroke[0].y);
                stroke.forEach(point => ctx.lineTo(point.x, point.y));
                ctx.stroke();
            }
        });
        
        // Draw current stroke
        ctx.beginPath();
        ctx.moveTo(smoothedPoints[0].x, smoothedPoints[0].y);
        for (let i = 1; i < smoothedPoints.length; i++) {
            ctx.lineTo(smoothedPoints[i].x, smoothedPoints[i].y);
        }
        ctx.stroke();
    }
}

// Modified stop drawing function
function stopDrawing() {
    if (!drawing) return;
    drawing = false;
    if (points.length > 0) {
        strokeHistory.push(smoothedPoints.length > 0 ? [...smoothedPoints] : [...points]);
    }
    points = [];
    smoothedPoints = [];
}

// Add touch event listeners
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    drawing = true;
    points = [];
    smoothedPoints = [];
    const pos = getTouchPos(canvas, e);
    lastPoint = pos;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
});

canvas.addEventListener('touchmove', draw);
canvas.addEventListener('touchend', stopDrawing);
canvas.addEventListener('touchcancel', stopDrawing);

// Keep existing mouse event listeners
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

// Add these utility functions before calculateScore
function preprocessCanvas(canvas) {
    return tf.tidy(() => {
        // Convert canvas to tensor
        let tensor = tf.browser.fromPixels(canvas, 1);
        
        // Resize to 28x28
        tensor = tf.image.resizeBilinear(tensor, [28, 28]);
        
        // Normalize values to [0, 1]
        tensor = tensor.toFloat().div(tf.scalar(255));
        
        // Add batch dimension
        return tensor.expandDims(0);
    });
}

function aggregatePointsFromStrokeHistory(strokes) {
    const allPoints = [];

    // Draw user strokes
    userCtx.fillStyle = 'white';
    userCtx.fillRect(0, 0, canvas.width, canvas.height);
    userCtx.strokeStyle = 'black';
    userCtx.lineWidth = 3;
    userCtx.lineCap = 'round';
    userCtx.lineJoin = 'round';
    
    strokeHistory.forEach(stroke => {
        if (stroke.length > 0) {
            userCtx.beginPath();
            userCtx.moveTo(stroke[0].x, stroke[0].y);
            stroke.forEach(point => ctx.lineTo(point.x, point.y));
            ctx.stroke();
        }
    });

    // Get image data
    const refData = refCtx.getImageData(0, 0, canvas.width, canvas.height).data;
    const userData = userCtx.getImageData(0, 0, canvas.width, canvas.height).data;

    let matchingPixels = 0;
    let totalTargetPixels = 0;
    let extraPixels = 0;
    const tolerance = 8; // Increased tolerance

    // Compare pixels with tolerance
    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4;
            const isRefBlack = refData[i] < 200; // Relaxed threshold for black
            const isUserBlack = userData[i] < 200;

            if (isRefBlack) {
                totalTargetPixels++;
                // Check surrounding pixels
                let matched = false;
                for (let dy = -tolerance; dy <= tolerance && !matched; dy++) {
                    for (let dx = -tolerance; dx <= tolerance && !matched; dx++) {
                        const ni = ((y + dy) * canvas.width + (x + dx)) * 4;
                        if (ni >= 0 && ni < userData.length && userData[ni] < 200) {
                            matched = true;
                            matchingPixels++;
                        }
                    }
                }
            } else if (isUserBlack) {
                // Check if this black pixel is near any reference black pixel
                let nearTarget = false;
                for (let dy = -tolerance; dy <= tolerance && !nearTarget; dy++) {
                    for (let dx = -tolerance; dx <= tolerance && !nearTarget; dx++) {
                        const ni = ((y + dy) * canvas.width + (x + dx)) * 4;
                        if (ni >= 0 && ni < refData.length && refData[ni] < 200) {
                            nearTarget = true;
                        }
                    }
                }
                if (!nearTarget) {
                    extraPixels++;
                }
            }
        }
    }

    // Calculate weighted score with adjusted weights and scaling
    const coverage = matchingPixels / (totalTargetPixels || 1);
    const precision = 1 - (extraPixels / (totalTargetPixels || 1));
    
    // Adjust weights to emphasize coverage more than precision
    const weightedScore = (coverage * 0.8 + Math.max(0, precision) * 0.2) * 100;

    // Scale the score to make it more achievable
    const scaledScore = Math.min(100, Math.max(0, weightedScore * 1.5));
    
    return scaledScore;
}

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
        feedbackDiv.style.color = "green";
    } else if (score > 50) {
        feedbackDiv.textContent = isEnglish ?
            "Father-in-law: Interesting way to write 'sir'!" :
            "親家老爺:原來個sir字都有得寫嘅 真係活到老 學到老 ";
        feedbackDiv.style.color = "orange";
    } else {
        feedbackDiv.textContent = isEnglish ?
            "So you're a police officer! 🔫" :
            "原來你係警察🔫!!！";
        feedbackDiv.style.color = "red";
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
    calculateScore().then(score => {
        const isEnglish = document.documentElement.lang === 'en';
        scoreDiv.textContent = isEnglish ? `Score: ${score.toFixed(0)}%` : `得分: ${score.toFixed(0)}%`;
        scoreDiv.classList.add('visible');
        
        if (score < 50) {
            showFailureEffect();
            feedbackDiv.textContent = isEnglish ? 
                "So you're a police officer! 🔫" : 
                "原來你係警察🔫!!！";
            feedbackDiv.style.color = "#e74c3c";
        } else {
            showSuccessEffect();
            provideFeedback(score);
        }
    });
}

submitButtonZh.addEventListener('click', handleSubmit);
submitButtonEn.addEventListener('click', handleSubmit);

resetButton.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    points = [];
    strokeHistory.length = 0;
    feedbackDiv.textContent = "";
    scoreDiv.classList.remove('visible');
    const container = document.querySelector('.container');
    container.classList.remove('game-over');
    const isEnglish = document.documentElement.lang === 'en';
    scoreDiv.textContent = isEnglish ? 'Score: 0%' : '得分: 0%';
});

undoButton.addEventListener('click', () => {
    if (strokeHistory.length > 0) {
        strokeHistory.pop();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        strokeHistory.forEach(stroke => {
            ctx.beginPath();
            ctx.moveTo(stroke[0].x, stroke[0].y);
            stroke.forEach(point => {
                ctx.lineTo(point.x, point.y);
                ctx.stroke();
            });
        });
    }
});

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
    const score = scoreDiv.textContent.match(/\d+/);
    if (score) {
        scoreDiv.textContent = newLang === 'en' ? `Score: ${score[0]}%` : `得分: ${score[0]}%`;
    } else {
        scoreDiv.textContent = newLang === 'en' ? 'Score: 0%' : '得分: 0%';
    }
}

// Initialize language
document.addEventListener('DOMContentLoaded', () => {
    const userLang = navigator.language || navigator.userLanguage;
    const initialLang = userLang.startsWith('zh') ? 'zh' : 'en';
    document.documentElement.lang = initialLang;
    
    // Update initial score text based on language
    scoreDiv.textContent = initialLang === 'en' ? 'Score: 0%' : '得分: 0%';
    
    document.querySelectorAll(`[lang="${initialLang}"]`).forEach(el => {
        el.classList.add('active');
    });
});

// Replace the calculateScore function with this improved version
function calculateScore() {
    return new Promise((resolve) => {
        const refCanvas = document.createElement('canvas');
        const userCanvas = document.createElement('canvas');
        refCanvas.width = userCanvas.width = canvas.width;
        refCanvas.height = userCanvas.height = canvas.height;
        const refCtx = refCanvas.getContext('2d');
        const userCtx = userCanvas.getContext('2d');

        // Draw reference pattern
        refCtx.fillStyle = 'white';
        refCtx.fillRect(0, 0, refCanvas.width, refCanvas.height);
        refCtx.fillStyle = 'black';
        const lines = targetCharacter.split('\n');
        const cellHeight = refCanvas.height / lines.length;
        const cellWidth = refCanvas.width / lines[0].length;
        
        lines.forEach((line, y) => {
            [...line].forEach((char, x) => {
                if (char === '#') {
                    refCtx.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
                }
            });
        });

        // Draw user strokes with thicker lines
        userCtx.fillStyle = 'white';
        userCtx.fillRect(0, 0, canvas.width, canvas.height);
        userCtx.strokeStyle = 'black';
        userCtx.lineWidth = 5; // Increased line width
        userCtx.lineCap = 'round';
        userCtx.lineJoin = 'round';
        
        strokeHistory.forEach(stroke => {
            if (stroke.length > 0) {
                userCtx.beginPath();
                userCtx.moveTo(stroke[0].x, stroke[0].y);
                stroke.forEach(point => userCtx.lineTo(point.x, point.y));
                userCtx.stroke();
            }
        });

        // Get image data
        const refData = refCtx.getImageData(0, 0, canvas.width, canvas.height).data;
        const userData = userCtx.getImageData(0, 0, canvas.width, canvas.height).data;

        let matchingPixels = 0;
        let totalTargetPixels = 0;
        let extraPixels = 0;
        const tolerance = 12; // Increased tolerance

        // Compare pixels with tolerance
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const i = (y * canvas.width + x) * 4;
                const isRefBlack = refData[i] < 200;
                const isUserBlack = userData[i] < 200;

                if (isRefBlack) {
                    totalTargetPixels++;
                    // Check surrounding pixels with larger area
                    let matched = false;
                    for (let dy = -tolerance; dy <= tolerance && !matched; dy++) {
                        for (let dx = -tolerance; dx <= tolerance && !matched; dx++) {
                            if (dx * dx + dy * dy <= tolerance * tolerance) { // Circular tolerance area
                                const ni = ((y + dy) * canvas.width + (x + dx)) * 4;
                                if (ni >= 0 && ni < userData.length && userData[ni] < 200) {
                                    matched = true;
                                    matchingPixels++;
                                }
                            }
                        }
                    }
                } else if (isUserBlack) {
                    // Check if this black pixel is near any reference black pixel
                    let nearTarget = false;
                    for (let dy = -tolerance; dy <= tolerance && !nearTarget; dy++) {
                        for (let dx = -tolerance; dx <= tolerance && !nearTarget; dx++) {
                            if (dx * dx + dy * dy <= tolerance * tolerance) { // Circular tolerance area
                                const ni = ((y + dy) * canvas.width + (x + dx)) * 4;
                                if (ni >= 0 && ni < refData.length && refData[ni] < 200) {
                                    nearTarget = true;
                                }
                            }
                        }
                    }
                    if (!nearTarget) {
                        extraPixels++;
                    }
                }
            }
        }

        // Calculate base scores
        const coverage = matchingPixels / (totalTargetPixels || 1);
        const precision = 1 - Math.min(1, (extraPixels / (totalTargetPixels || 1)));
        
        // Apply non-linear scaling to make scores more achievable
        const scaledCoverage = Math.pow(coverage, 0.7) * 100; // Makes it easier to get higher coverage scores
        const scaledPrecision = Math.pow(Math.max(0, precision), 0.5) * 100; // More forgiving for precision
        
        // Weight the components (more emphasis on coverage)
        const weightedScore = (scaledCoverage * 0.8 + scaledPrecision * 0.2);
        
        // Apply final scaling and bonus points
        let finalScore = Math.min(100, weightedScore * 1.3); // Boost scores by 30%
        
        // Add bonus points for having both good coverage and precision
        if (coverage > 0.6 && precision > 0.3) {
            finalScore += 10; // Bonus points for balanced drawing
        }
        
        // Ensure maximum score is 100
        finalScore = Math.min(100, Math.max(0, finalScore));
        
        resolve(Math.round(finalScore));
    });
}