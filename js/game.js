// Audio Context
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function initAudioContext() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playJumpSound() {
    initAudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'square';
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.start(now);
    osc.stop(now + 0.1);
}

function playDeathSound() {
    initAudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.start(now);
    osc.stop(now + 0.3);
}

// Canvas Setup
const CANVAS_BASE_W = 800;
const CANVAS_BASE_H = 300;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('gameContainer');
const mobileControls = document.getElementById('mobileControls');
const btnJump = document.getElementById('btnJump');
const btnShoot = document.getElementById('btnShoot');

let isTouchDevice = false;
let canvasScale = 1;

function resizeCanvas() {
    const badge = document.querySelector('.offline-badge');
    const badgeH = badge ? badge.offsetHeight + 16 : 0;
    const ctrlH = isTouchDevice ? (mobileControls.offsetHeight || 104) : 0;
    const padding = 20;

    const availW = window.innerWidth - padding;
    const availH = window.innerHeight - badgeH - ctrlH - padding * 2;

    const scaleW = availW / CANVAS_BASE_W;
    const scaleH = availH / CANVAS_BASE_H;
    canvasScale = Math.min(scaleW, scaleH, isTouchDevice ? 1 : 1.5);

    const displayW = Math.floor(CANVAS_BASE_W * canvasScale);
    const displayH = Math.floor(CANVAS_BASE_H * canvasScale);

    canvas.width = CANVAS_BASE_W;
    canvas.height = CANVAS_BASE_H;

    canvas.style.width = displayW + 'px';
    canvas.style.height = displayH + 'px';
    container.style.width = displayW + 'px';
    container.style.height = displayH + 'px';

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
}

function detectTouch() {
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        isTouchDevice = true;
        mobileControls.style.display = 'block';
        const di = document.getElementById('desktopInstructions');
        if (di) di.style.display = 'none';
    }
}

detectTouch();
window.addEventListener('resize', resizeCanvas);
setTimeout(resizeCanvas, 50);

// Game State
let frames = 0;
let score = 0;
let highScore = localStorage.getItem('adashima_hs') || 0;
let isGameOver = false;
let baseSpeed = 4.5;
let gameSpeed = baseSpeed;
let obstacles = [];
let spawnRate = 90;
let particles = [];
let combo = 0;
let boomerangs = [];
let isInvulnerable = false;
let invulnerabilityTime = 0;
let lastDonaSpawn = -100;
let powerUpParticles = [];
let gameTimeSeconds = 0;
let starRainActive = false;
let lastStarRainTime = -100;
let donutSpawnActive = false;

// Images
const imgYashiro = new Image();
imgYashiro.src = 'Imagenes/Yashiro_flotante_pixel-Photoroom.png';

const imgmeteoro = new Image();
imgmeteoro.src = 'Imagenes/meteoro-Photoroom.png';

const imgEstrella = new Image();
imgEstrella.src = 'Imagenes/Estrella-Photoroom.png';

const imgEstrellaAzul = new Image();
imgEstrellaAzul.src = 'Imagenes/Estrella_Azul-Photoroom.png';

const imgFondo = new Image();
imgFondo.src = 'Imagenes/Fondo_pixel.png';

const imgBoomerang = new Image();
imgBoomerang.src = 'Imagenes/boomerang-Photoroom.png';

const imgDona = new Image();
imgDona.src = 'Imagenes/dona_pixel-Photoroom.png';

// Yashiro Player
const yashiro = {
    x: 50,
    y: 200,
    width: 100,
    height: 100,
    dy: 0,
    jumpForce: 11,
    gravity: 0.65,
    grounded: false,

    hitboxOffset: { x: 35, y: 15, w: -70, h: -25 },

    getHitbox() {
        return {
            x: this.x + this.hitboxOffset.x,
            y: this.y + this.hitboxOffset.y,
            width: this.width + this.hitboxOffset.w,
            height: this.height + this.hitboxOffset.h
        };
    },

    draw() {
        ctx.drawImage(imgYashiro, this.x, this.y, this.width, this.height);
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        ctx.beginPath();
        ctx.ellipse(this.x + this.width/2, 255, this.width * 0.4, 6, 0, 0, Math.PI * 2);
        ctx.fill();
    },

    jump() {
        if (this.grounded) {
            this.dy = -this.jumpForce;
            this.grounded = false;
            playJumpSound();
        }
    },

    update() {
        this.y += this.dy;
        if (this.y + this.height < 250) {
            this.dy += this.gravity;
            this.grounded = false;
        } else {
            this.dy = 0;
            this.grounded = true;
            this.y = 250 - this.height;
        }
        this.draw();
    }
};

// Game Functions
function resetGame() {
    obstacles = [];
    score = 0;
    frames = 0;
    gameSpeed = baseSpeed;
    spawnRate = 90;
    isGameOver = false;
    yashiro.y = 200;
    yashiro.dy = 0;
    boomerangs = [];
    isInvulnerable = false;
    invulnerabilityTime = 0;
    lastDonaSpawn = -100;
    powerUpParticles = [];
    gameTimeSeconds = 0;
    starRainActive = false;
    lastStarRainTime = -100;
    donutSpawnActive = false;
}

function spawnObstacle() {
    let size = 35;
    let typeImg;
    let yPos;
    let isBluestar = false;
    let health = 1;

    if (!starRainActive) {
        let types = score >= 100 ? [imgmeteoro, imgEstrella] : [imgmeteoro];
        typeImg = types[Math.floor(Math.random() * types.length)];
        let randomStarY = Math.floor(Math.random() * 110) + 100;

        if (typeImg === imgmeteoro) {
            let roll = Math.random();
            if (roll < 0.4) size = 32;
            else if (roll < 0.8) size = 44;
            else size = 50;
            yPos = 250 - size;
        } else {
            size = 35;
            yPos = randomStarY;
        }
    } else {
        if (Math.random() > 0.6) {
            typeImg = imgEstrella;
            health = 1;
        } else {
            typeImg = imgEstrellaAzul;
            health = 4;
            isBluestar = true;
        }
        yPos = Math.floor(Math.random() * 110) + 100;
    }

    obstacles.push({
        x: canvas.width,
        y: yPos,
        width: size,
        height: size,
        image: typeImg,
        rotation: 0,
        health: health,
        isBluestar: isBluestar,
        baseY: yPos,
        verticalOscillation: starRainActive ? Math.sin(Math.random() * Math.PI * 2) * 40 : 0,
        oscillationSpeed: starRainActive ? 0.08 + Math.random() * 0.04 : 0,
        oscillationPhase: Math.random() * Math.PI * 2,
        hitboxOffset: { x: 3, y: 3, w: -6, h: -6 },

        getHitbox() {
            return {
                x: this.x + this.hitboxOffset.x,
                y: this.y + this.hitboxOffset.y,
                width: this.width + this.hitboxOffset.w,
                height: this.height + this.hitboxOffset.h
            };
        },

        draw() {
            if (this.image === imgEstrella || this.image === imgEstrellaAzul) {
                ctx.save();
                ctx.translate(this.x + this.width/2, this.y + this.height/2);
                ctx.rotate(this.rotation);
                ctx.drawImage(this.image, -this.width/2, -this.height/2, this.width, this.height);
                ctx.restore();
                if (this.isBluestar && this.health > 1) {
                    ctx.fillStyle = "rgba(255,255,255,0.7)";
                    ctx.font = "bold 16px Quicksand";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(this.health, this.x + this.width/2, this.y + this.height/2);
                }
            } else {
                ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
            }
        },

        update() {
            this.x -= gameSpeed;
            if (starRainActive && this.oscillationSpeed > 0) {
                this.oscillationPhase += this.oscillationSpeed;
                this.y = this.baseY + Math.sin(this.oscillationPhase) * this.verticalOscillation;
            }
            this.rotation += 0.1;
            this.draw();
        }
    });
}

function spawnParticles(x, y, color = '#a28cbd') {
    for (let i = 0; i < 8; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 40,
            color,
            draw() {
                ctx.globalAlpha = this.life / 40;
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            },
            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.vy += 0.3;
                this.life--;
                this.draw();
            }
        });
    }
}

function spawnDona() {
    let size = 30;
    obstacles.push({
        x: canvas.width,
        y: Math.floor(Math.random() * 110) + 100,
        width: size,
        height: size,
        image: imgDona,
        rotation: 0,
        isPowerUp: true,
        hitboxOffset: { x: 3, y: 3, w: -6, h: -6 },
        getHitbox() {
            return {
                x: this.x + this.hitboxOffset.x,
                y: this.y + this.hitboxOffset.y,
                width: this.width + this.hitboxOffset.w,
                height: this.height + this.hitboxOffset.h
            };
        },
        draw() {
            ctx.save();
            ctx.translate(this.x + this.width/2, this.y + this.height/2);
            ctx.rotate(this.rotation);
            ctx.drawImage(this.image, -this.width/2, -this.height/2, this.width, this.height);
            ctx.restore();
            ctx.strokeStyle = "rgba(255,215,0,0.4)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/2 + 8, 0, Math.PI * 2);
            ctx.stroke();
        },
        update() {
            this.x -= gameSpeed;
            this.rotation += 0.15;
            this.draw();
        }
    });
}

function fireBoomerang() {
    boomerangs.push({
        x: yashiro.x + yashiro.width,
        y: yashiro.y + yashiro.height / 2,
        width: 30,
        height: 30,
        speed: 8,
        rotation: 0,
        draw() {
            ctx.save();
            ctx.translate(this.x + this.width/2, this.y + this.height/2);
            ctx.rotate(this.rotation);
            ctx.drawImage(imgBoomerang, -this.width/2, -this.height/2, this.width, this.height);
            ctx.restore();
        },
        update() {
            this.x += this.speed;
            this.rotation += 0.3;
            this.draw();
        }
    });
}

// Main Animation Loop
function animate() {
    if (isGameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillRect(canvas.width/2 - 180, canvas.height/2 - 90, 360, 180);

        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 2;
        ctx.strokeRect(canvas.width/2 - 180, canvas.height/2 - 90, 360, 180);

        ctx.fillStyle = "#ff6b6b";
        ctx.font = "bold 48px Quicksand";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width/2, canvas.height/2 - 35);

        ctx.fillStyle = "white";
        ctx.font = "22px Quicksand";
        ctx.fillText(`Puntos: ${score}`, canvas.width/2, canvas.height/2 + 10);

        ctx.fillStyle = "#ffd700";
        ctx.font = "22px Quicksand";
        ctx.fillText(`Récord: ${highScore}`, canvas.width/2, canvas.height/2 + 40);

        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.font = "16px Quicksand";
        const restartMsg = isTouchDevice
            ? "Toca SALTAR para reiniciar"
            : "Presiona ESPACIO o toca para reiniciar";
        ctx.fillText(restartMsg, canvas.width/2, canvas.height/2 + 75);

        return;
    }

    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(imgFondo, 0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.moveTo(0, 250);
    ctx.lineTo(canvas.width, 250);
    ctx.strokeStyle = "rgba(162,140,189,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    yashiro.update();

    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].life <= 0) particles.splice(i, 1);
    }

    if (isInvulnerable) {
        invulnerabilityTime--;
        if (invulnerabilityTime <= 0) isInvulnerable = false;
    }

    // Boomerangs
    for (let i = boomerangs.length - 1; i >= 0; i--) {
        let boom = boomerangs[i];
        boom.update();

        if (boom.x > canvas.width) {
            boomerangs.splice(i, 1);
            continue;
        }

        for (let j = obstacles.length - 1; j >= 0; j--) {
            let obs = obstacles[j];
            if ((obs.image === imgEstrella || obs.image === imgEstrellaAzul) && !obs.isPowerUp) {
                if (boom.x < obs.x + obs.width &&
                    boom.x + boom.width > obs.x &&
                    boom.y < obs.y + obs.height &&
                    boom.y + boom.height > obs.y) {

                    obs.health--;
                    spawnParticles(obs.x + obs.width/2, obs.y + obs.height/2, '#ffd700');

                    if (obs.health <= 0) obstacles.splice(j, 1);

                    boomerangs.splice(i, 1);
                    break;
                }
            }
        }
    }

    frames++;

    if (frames % 6 === 0) {
        score++;
    }

    // Game Time
    const newTime = Math.floor(frames / 60);
    if (newTime !== gameTimeSeconds) {
        gameTimeSeconds = newTime;

        if (gameTimeSeconds > 0 && gameTimeSeconds % 5 === 0) {
            gameSpeed = Math.min(gameSpeed + 0.15, 9.5);
            if (spawnRate > 50) spawnRate = Math.max(50, spawnRate - 2);
        }

        if (gameTimeSeconds >= 100) {
            if (!donutSpawnActive) {
                donutSpawnActive = true;
                lastDonaSpawn = gameTimeSeconds;
                spawnDona();
            }
            if (donutSpawnActive && gameTimeSeconds - lastDonaSpawn >= 30) {
                spawnDona();
                lastDonaSpawn = gameTimeSeconds;
            }
        }
    }

    // Star Rain
    if (gameTimeSeconds > 0 && gameTimeSeconds % 50 === 0 && gameTimeSeconds !== lastStarRainTime) {
        starRainActive = true;
        lastStarRainTime = gameTimeSeconds;
    }

    if (starRainActive && gameTimeSeconds - lastStarRainTime >= 15) {
        starRainActive = false;
    }

    let adjustedSpawnRate = starRainActive ? 45 : spawnRate;
    if (frames % adjustedSpawnRate === 0) spawnObstacle();

    // Collision Detection
    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        obs.update();

        let yBox = yashiro.getHitbox();
        let oBox = obs.getHitbox();

        if (yBox.x < oBox.x + oBox.width &&
            yBox.x + yBox.width > oBox.x &&
            yBox.y < oBox.y + oBox.height &&
            yBox.y + yBox.height > oBox.y) {

            if (obs.isPowerUp) {
                isInvulnerable = true;
                invulnerabilityTime = 300;
                spawnParticles(obs.x + obs.width/2, obs.y + obs.height/2, '#ffd700');
                for (let k = 0; k < 15; k++) {
                    powerUpParticles.push({
                        x: yashiro.x + yashiro.width/2,
                        y: yashiro.y + yashiro.height/2,
                        vx: (Math.random() - 0.5) * 12,
                        vy: (Math.random() - 0.5) * 12,
                        life: 60,
                        color: '#FFD700',
                        draw() {
                            ctx.globalAlpha = this.life / 60;
                            ctx.fillStyle = this.color;
                            ctx.beginPath();
                            ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
                            ctx.fill();
                            ctx.globalAlpha = 1;
                        },
                        update() {
                            this.x += this.vx;
                            this.y += this.vy;
                            this.vy += 0.2;
                            this.life--;
                            this.draw();
                        }
                    });
                }
                obstacles.splice(i, 1);
                i--;
                continue;
            }

            if (!isInvulnerable) {
                if (!isGameOver) {
                    playDeathSound();
                }
                isGameOver = true;
                combo = 0;
                spawnParticles(yashiro.x + yashiro.width/2, yashiro.y + yashiro.height/2, '#d32f2f');
                if (score > highScore) {
                    highScore = score;
                    localStorage.setItem('adashima_hs', highScore);
                }
            } else {
                obstacles.splice(i, 1);
                i--;
                continue;
            }
        }

        if (obs.x + obs.width < 0) {
            obstacles.splice(i, 1);
            i--;
            if (!obs.isPowerUp) {
                combo++;
                spawnParticles(yashiro.x + yashiro.width/2, yashiro.y + yashiro.height/2, '#4caf50');
            }
        }
    }

    // UI Overlay
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.font = "20px Quicksand";
    ctx.textAlign = "left";
    ctx.fillText(`Puntos: ${score}`, 22, 42);
    ctx.textAlign = "right";
    ctx.fillText(`Récord: ${highScore}`, canvas.width - 18, 42);

    ctx.fillStyle = "rgb(255,255,255)";
    ctx.font = "bold 20px Quicksand";
    ctx.textAlign = "left";
    ctx.fillText(`Puntos: ${score}`, 20, 40);
    ctx.textAlign = "right";
    ctx.fillText(`Récord: ${highScore}`, canvas.width - 20, 40);

    if (combo >= 3) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.font = "bold 28px Quicksand";
        ctx.textAlign = "center";
        ctx.fillText(`🔥 COMBO x${combo}`, canvas.width/2 + 2, 54);
        ctx.fillStyle = "#ff9800";
        ctx.fillText(`🔥 COMBO x${combo}`, canvas.width/2, 50);
    }

    if (isInvulnerable) {
        let invulPercent = Math.ceil((invulnerabilityTime / 300) * 100);
        ctx.fillStyle = "rgba(255,215,0,0.6)";
        ctx.font = "bold 24px Quicksand";
        ctx.textAlign = "center";
        ctx.fillText(`🛡️ INVULNERABLE ${invulPercent}%`, canvas.width/2, canvas.height - 30);
        ctx.strokeStyle = `rgba(255,215,0,${0.5 - (300 - invulnerabilityTime) / 1200})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(yashiro.x + yashiro.width/2, yashiro.y + yashiro.height/2, yashiro.width/2 + 15, 0, Math.PI * 2);
        ctx.stroke();
    }

    if (starRainActive) {
        let timeRemainingInRain = 15 - (gameTimeSeconds - lastStarRainTime);
        ctx.fillStyle = "rgba(100,200,255,0.7)";
        ctx.font = "bold 32px Quicksand";
        ctx.textAlign = "center";
        ctx.fillText(`🌧️ LLUVIA DE ESTRELLAS - ${timeRemainingInRain}s`, canvas.width/2, 90);
    } else {
        let timeToNextEvent = 50 - (gameTimeSeconds % 50);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "14px Quicksand";
        ctx.textAlign = "center";
        ctx.fillText(`Próx. Lluvia: ${timeToNextEvent}s`, canvas.width/2, 270);
    }

    for (let i = powerUpParticles.length - 1; i >= 0; i--) {
        powerUpParticles[i].update();
        if (powerUpParticles[i].life <= 0) powerUpParticles.splice(i, 1);
    }
}

// Input Handlers
function handleKeyDown(e) {
    if (e.code === 'Space') {
        e.preventDefault();
        if (isGameOver) { resetGame(); animate(); }
        else { yashiro.jump(); }
    }
    if (e.code === 'ArrowDown' && !isGameOver) {
        e.preventDefault();
        fireBoomerang();
    }
}

window.addEventListener('keydown', handleKeyDown);

// Canvas Touch/Click
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (isTouchDevice) {
        if (isGameOver) { resetGame(); animate(); }
    } else {
        if (isGameOver) { resetGame(); animate(); }
        else { yashiro.jump(); }
    }
}, { passive: false });

canvas.addEventListener('click', () => {
    if (!isTouchDevice) {
        if (isGameOver) { resetGame(); animate(); }
        else { yashiro.jump(); }
    }
});

// Mobile Buttons
btnJump.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (isGameOver) { resetGame(); animate(); }
    else { yashiro.jump(); }
}, { passive: false });

btnJump.addEventListener('click', () => {
    if (isGameOver) { resetGame(); animate(); }
    else { yashiro.jump(); }
});

btnShoot.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!isGameOver) fireBoomerang();
}, { passive: false });

btnShoot.addEventListener('click', () => {
    if (!isGameOver) fireBoomerang();
});

// Start Game
animate();

// Reload on online
window.addEventListener('online', () => {
    window.location.reload();
});