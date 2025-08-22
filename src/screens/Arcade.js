// src/Arcade.js
import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaVolumeUp, FaVolumeMute } from 'react-icons/fa';
import '../css/arcade.css';
import carImgSrc from '../img/arcade_model_car.png';
import carsData from '../data/carsData';
import { useBalance, formatMoney } from '../balance';

// Вражеские машины — оставить эти импорты
import opp1Src from '../img/opponent_car_1.png';
import opp2Src from '../img/opponent_car_2.png';
import opp3Src from '../img/opponent_car_3.png';
import opp4Src from '../img/opponent_car_4.png';
import opp5Src from '../img/opponent_car_5.png';
import opp6Src from '../img/opponent_car_6.png';

// Импорт звуков
import sfxCoin from '../sfx/coin.mp3';
import sfxCrash from '../sfx/crash.mp3';

const PURCHASED_KEY = 'purchasedCars';

export default function Arcade() {
    const { add, balance } = useBalance();
    const canvasRef   = useRef(null);
    const navigate    = useNavigate();

    // function handleExit() {
    //     navigate('/', { replace: true });
    // }

    const [score, setScore]           = useState(0);
    const [gameOver, setGameOver]     = useState(false);
    const [carLoaded, setCarLoaded]   = useState(false);
    const [oppsLoaded, setOppsLoaded] = useState(false);

    // стартовый экран
    const [started, setStarted] = useState(false);
    const [availableCars, setAvailableCars] = useState([]);
    const [selectedCar, setSelectedCar] = useState(null);

    // счёт и время
    const scoreRef       = useRef(0);
    const prevTsRef      = useRef(0);
    const lastObsRef     = useRef(0);
    const lastCoinRef    = useRef(0);
    const startTimeRef   = useRef(0);      // момент старта
    const elapsedMsRef   = useRef(0);      // прошедшее время
    const gameOverRef    = useRef(false);  // защита от повторного конца

    // --- Апгрейд монетки ---
    const COIN_BASE = 10;   // базовая монета +10$
    const COIN_STEP = 5;    // +5$ за каждый уровень
    const COIN_PER_LEVEL_BASE = 1000;     // первый апгрейд — 1000$
    const COIN_PER_LEVEL_MUL  = 1.4;      // каждый следующий порог *= 1.3 и округляется

    const coinValueRef   = useRef(COIN_BASE); // текущий номинал монеты (для игры)
    const coinLevelRef   = useRef(0);         // текущий уровень
    const totalEarnedRef = useRef(0);         // накоплено за все сессии

    // для отображения в UI шторки
    const [coinValue, setCoinValue]   = useState(COIN_BASE);
    const [coinLevel, setCoinLevel]   = useState(0);
    const [totalEarned, setTotalEarned] = useState(0);

    // объекты
    const obstaclesRef   = useRef([]);
    const coinsRef       = useRef([]);
    const sameDirRef     = useRef([]);   // попутные машины
    const lastSameRef    = useRef(0);    // таймер спавна попутных

    // управление: цель — X пальца (следуем к пальцу с ограничением скорости)
    const isFingerDownRef = useRef(false);
    const targetXRef      = useRef(null);
    const targetYRef      = useRef(null);

    // всплывающие надписи "+1$"
    const floatersRef = useRef([]); // {x, y, vy, life, t}

    const accelUpRef  = useRef(1200);  // px/s^2 — базовый разгон
    const vMaxRef     = useRef(550);   // px/s   — базовая максималка

    // изображения
    const carImage  = useRef(new Image());
    const oppImages = useRef([]);
    const roadDashOffRef = useRef(0); // смещение «штрихов» для анимации разметки

    // звуки
    const [muted, setMuted] = useState(false);

    const coinPoolRef   = useRef([]);   // пул звуков монетки
    const coinPoolIdxRef = useRef(0);   // циклический индекс
    const crashSndRef   = useRef(null);

    // базовые громкости
    const baseVolRef = useRef({ coin: 0.4, crash: 0.4 });

    // итоговая сводка (для окна game over)
    const [summary, setSummary] = useState({
        timeMs: 0,
        isScoreRecord: false,
        isTimeRecord: false,
        bestScore: 0,
        bestTimeMs: 0
    });

    const formatTime = (ms) => {
        const totalSec = Math.floor(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // пересчёт уровня/прогресса по суммарному заработку с геометрической прогрессией
    function coinLevelFromTotal(total) {
        let level = 0;
        let need  = Math.round(COIN_PER_LEVEL_BASE);  // сколько нужно для текущего NEXT-уровня
        let spentBefore = 0;                          // суммарно «поглощённые» пороги
        let remain = total;

        while (remain >= need) {
            remain -= need;
            spentBefore += need;
            level += 1;
            // следующий порог: умножаем на коэффициент и округляем
            need = Math.max(1, Math.round(need * COIN_PER_LEVEL_MUL));
        }

        const progress = need > 0 ? remain / need : 0;

        return {
            level,                 // текущий уровень
            progress,              // 0..1 прогресс к следующему апгрейду
            currentReq: need,      // сколько нужно на ЭТОМ уровне
            earnedInLevel: remain, // сколько уже набито в рамках этого уровня
            spentBefore
        };
    }

    // загрузка дефолтной машины игрока
    useEffect(() => {
        carImage.current.src = carImgSrc;
        carImage.current.onload = () => setCarLoaded(true);
    }, []);

    // загрузка PNG встречных машин
    useEffect(() => {
        const sources = [opp1Src, opp2Src, opp3Src, opp4Src, opp5Src, opp6Src];
        oppImages.current = sources.map(src => {
            const img = new Image();
            img.src = src;
            return img;
        });
        let ready = 0;
        oppImages.current.forEach(img => {
            if (img.complete) {
                ready++;
                if (ready === sources.length) setOppsLoaded(true);
            } else {
                img.onload = () => {
                    ready++;
                    if (ready === sources.length) setOppsLoaded(true);
                };
            }
        });
    }, []);

    // подтягиваем машины из автосервиса (только waiting)
    useEffect(() => {
        try {
            const raw = localStorage.getItem(PURCHASED_KEY);
            const all = raw ? JSON.parse(raw) : [];
            const waiting = all.filter(c => c.status === 'waiting');
            setAvailableCars(waiting);
            if (waiting.length) setSelectedCar(waiting[0]);
        } catch {}
    }, []);

    const resetGame = () => {
        scoreRef.current        = 0;
        setScore(0);
        obstaclesRef.current    = [];
        coinsRef.current        = [];
        sameDirRef.current      = [];
        lastObsRef.current      = 0;
        lastCoinRef.current     = 0;
        lastSameRef.current     = 0;
        prevTsRef.current       = 0;
        startTimeRef.current    = 0;
        elapsedMsRef.current    = 0;
        isFingerDownRef.current = false;
        targetXRef.current      = null;
        targetYRef.current      = null;
        floatersRef.current     = [];
        roadDashOffRef.current  = 0;
        setGameOver(false);
        setStarted(false);
        gameOverRef.current = false;
        setSummary({ timeMs: 0, isScoreRecord: false, isTimeRecord: false, bestScore: 0, bestTimeMs: 0 });
    };

    const endGame = () => {
        if (gameOverRef.current) return;
        gameOverRef.current = true;

        const timeMs = elapsedMsRef.current;

        const prevBestScore = Number(localStorage.getItem('arcadeBestScore') || 0);
        const prevBestTime  = Number(localStorage.getItem('arcadeBestTime')  || 0);

        const isScoreRecord = scoreRef.current > prevBestScore;
        const isTimeRecord  = timeMs > prevBestTime;

        if (isScoreRecord) localStorage.setItem('arcadeBestScore', String(scoreRef.current));
        if (isTimeRecord)  localStorage.setItem('arcadeBestTime',  String(timeMs));

        setSummary({
            timeMs,
            isScoreRecord,
            isTimeRecord,
            bestScore: Math.max(prevBestScore, scoreRef.current),
            bestTimeMs: Math.max(prevBestTime, timeMs)
        });

        if (crashSndRef.current) {
            try {
                crashSndRef.current.currentTime = 0;
                crashSndRef.current.play().catch(() => {});
            } catch {}
        }

        setGameOver(true);
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx    = canvas.getContext('2d');

        // физические размеры в CSS-пикселях
        const cssW = window.innerWidth;
        const cssH = window.innerHeight;

        // устройство может быть ретина → увеличим внутреннее разрешение
        const dpr = Math.min(3, window.devicePixelRatio || 1);

        // задаём реальное «буферное» разрешение канваса и масштаб контекста
        canvas.style.width  = cssW + 'px';
        canvas.style.height = cssH + 'px';
        canvas.width  = Math.floor(cssW * dpr);
        canvas.height = Math.floor(cssH * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // сразу включаем качественное сглаживание картинок
        ctx.imageSmoothingEnabled = true;
        try { ctx.imageSmoothingQuality = 'high'; } catch {}

        // дальше используем CSS-координаты
        const W = cssW;
        const H = cssH;

        const lanesCount       = 5;        // 5 полос → 4 вертикальных разделителя
        const laneW            = W / lanesCount;
        const dash             = 20;
        const gap              = 15;

        // игрок 50x100 — как встречные
        // адаптивный отступ снизу: ~12% высоты, но в пределах 80–140px
        const playerW = 50;
        const playerH = 100;
        const bottomGap = Math.max(80, Math.min(140, H * 0.16));
        const player = {
            w: playerW,
            h: playerH,
            x: W / 2 - playerW / 2,
            y: H - bottomGap - playerH,
            tilt: 0 // начальный угол
        };

        let prevPlayerX = player.x;               // для вычисления горизонтальной скорости
        const MAX_TILT = 0.22;                    // ≈ 12.6° максимальный наклон

        // вертикальная скорость игрока (сохраняется между кадрами внутри эффекта)
        let playerVy = 0;

        // «реальная» физика в пикселях
        const V_MAX     = vMaxRef.current  || 550;   // px/сек — максимальная вертикальная скорость
        const ACCEL_UP  = accelUpRef.current || 1200;  // px/сек^2 — разгон к цели (газ)
        const BRAKE_DN  = ACCEL_UP * 2.0;               // торможение масштабируем от разгона (сохраняем твоё соотношение 2:1)
        const IDLE_DEC  = ACCEL_UP * 1.0;               // замедление без газа тоже связано с «тягой»

        const forwardSpeedBase = 6;                 // px/кадр @60fps
        const lateralSpeedBase = 10;                 // px/кадр @60fps
        const obsIntervalBase  = 1500;              // базовый интервал спавна (мс)
        const coinIntervalBase = 1000;      // базовый интервал спавна монет (мс)
        const sameIntervalBase = 2000;   // попутные реже, чем встречные

        const ONCOMING_MIN = 0.90, ONCOMING_MAX = 1.15; // встречные: ±15%
        const SAME_MIN     = 0.90, SAME_MAX     = 1.15; // попутные: ±15%

        const rand = (min, max) => min + Math.random() * (max - min);

        // «скругление» хитбоксов (чем больше pad — тем «мягче» углы)
        const HB = {
            player: { padX: 5, padY: 7, tiltExtra: 3 },
            npc:    { padX: 5, padY: 7 }
        };

        // возвращает ужатый хитбокс; для игрока учитываем наклон (tilt)
        const getHitbox = (o, isPlayer = false) => {
            const padX = isPlayer ? HB.player.padX : HB.npc.padX;
            const padY = isPlayer ? HB.player.padY : HB.npc.padY;
            const extra = isPlayer ? (Math.abs(player.tilt) / MAX_TILT) * HB.player.tiltExtra : 0;

            const x = o.x + padX;
            const y = o.y + padY + extra * 0.2;         // чуть «срезаем» углы по Y
            const w = o.w - padX * 2;
            const h = o.h - (padY * 2 + extra * 0.4);   // сильный наклон → ещё компактнее
            return { x, y, w, h };
        };

        const overlap = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);

        let   animId;

        const renderStatic = () => {
            // фон
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, W, H);
            // прерывистые полосы
            ctx.strokeStyle = '#555';
            ctx.lineWidth   = 2;

            for (let i = 1; i < lanesCount; i++) {
                const x = i * laneW;

                if (i === 3) {
                    // третью рисуем как двойную СПЛОШНУЮ
                    ctx.save();
                    ctx.setLineDash([]);           // сплошная
                    ctx.lineDashOffset = 0;
                    const off = 3;                 // расстояние между двумя линиями
                    ctx.beginPath();
                    ctx.moveTo(x - off, 0);
                    ctx.lineTo(x - off, H);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(x + off, 0);
                    ctx.lineTo(x + off, H);
                    ctx.stroke();
                    ctx.restore();
                } else {
                    // остальные — пунктир и «едут»
                    ctx.save();
                    ctx.setLineDash([dash, gap]);
                    ctx.lineDashOffset = -roadDashOffRef.current;
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, H);
                    ctx.stroke();
                    ctx.restore();
                }
            }
            
            // авто (до старта)
            const px = player.x + player.w / 2;
            const py = player.y + player.h / 2;
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(player.tilt || 0);
            if (carLoaded) {
                ctx.drawImage(carImage.current, -player.w / 2, -player.h / 2, player.w, player.h);
            } else {
                ctx.fillStyle = '#4F4E4F';
                ctx.fillRect(-player.w / 2, -player.h / 2, player.w, player.h);
            }
            ctx.restore();
        };

        const loop = ts => {
            // delta-time нормализация
            const delta = prevTsRef.current ? ts - prevTsRef.current : (1000 / 60);
            prevTsRef.current = ts;
            const factor   = delta / (1000 / 60);
            const deltaSec = delta / 1000;
            const maxStepX = lateralSpeedBase * factor; // ограничение «скорости» к пальцу

            if (!started || gameOver) {
                renderStatic();
                animId = requestAnimationFrame(loop);
                return;
            }

            // время (для усложнения и итогов)
            elapsedMsRef.current = ts - startTimeRef.current;

            // МЯГКОЕ БЕСКОНЕЧНОЕ УСЛОЖНЕНИЕ
            const tSec = elapsedMsRef.current / 1000;

            // скорость «дороги» растёт мягче
            const speedMult = 1 + 0.4 * Math.log2(1 + tSec / 12); 
            // интервал спавна уменьшается чуть медленнее
            const obsInterval = obsIntervalBase / (1 + 0.6 * Math.log2(1 + tSec / 12));
            const sameInterval = sameIntervalBase / (1 + 0.5 * Math.log2(1 + tSec / 12)); // растёт мягче
            // шанс второго препятствия до 40% максимум, растёт медленнее
            const extraProb = Math.min(0.4, 0.05 + 0.18 * Math.log2(1 + tSec / 24));

            // монеты: чаще со временем + шанс 2-й монеты (помедленнее рост)
            const coinInterval = Math.max(280, coinIntervalBase / (1 + 0.45 * Math.log2(1 + tSec / 12)));
            const extraCoinProbCoin = Math.min(0.35, 0.05 + 0.14 * Math.log2(1 + tSec / 28));

            const dash = 20, gap = 15;                 // рисунок штрих-пунктирной линии
            const patternLen = dash + gap;
            roadDashOffRef.current = (roadDashOffRef.current + (forwardSpeedBase * 0.6 * factor * speedMult)) % patternLen;

            const Wcar = 50, Hcar = 100;
            
            // Функция отрисовки хитбоксов дебаг DEBUG
            const drawHB = (r, color) => {
                ctx.save();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.strokeRect(r.x, r.y, r.w, r.h);
                ctx.restore();
            };

            // прямоугольники пересекаются с вертикальным буфером bufferY
            const rectsOverlap = (ax, ay, aw, ah, bx, by, bw, bh, bufferY = 50) => {
                // ужимаем оба прямоугольника как npc-хитбоксы + вертикальный буфер
                const A = { x: ax + HB.npc.padX, y: ay + HB.npc.padY, w: aw - HB.npc.padX*2, h: ah - HB.npc.padY*2 };
                const B = { x: bx + HB.npc.padX, y: by + HB.npc.padY - bufferY,
                            w: bw - HB.npc.padX*2, h: bh - HB.npc.padY*2 + bufferY*2 };
                return overlap(A, B);
            };

            // выбираем X для встречной в ЛЕВЫХ 60% так, чтобы не пересекалось с уже имеющимися
            const leftSpawnMaxX = (W * 0.6) - Wcar;
            const pickFreeOncomingX = (spawnY) => {
                let tries = 0;
                while (tries < 12) {
                    const x = Math.random() * Math.max(1, leftSpawnMaxX);
                    const bad = obstaclesRef.current.some(o =>
                        rectsOverlap(x, spawnY, Wcar, Hcar, o.x, o.y, o.w, o.h, 60)
                    );
                    if (!bad) return x;
                    tries++;
                }
                return Math.random() * Math.max(1, leftSpawnMaxX); // fallback
            };

            // спавн встречных машин (со случайной PNG моделькой + опция второго)
            if (!lastObsRef.current) lastObsRef.current = ts;
            if (ts - lastObsRef.current > obsInterval) {
                // первое
                const Wcar = 50, Hcar = 100;
                const leftMaxX = (W * 0.6) - Wcar;
                const firstX = pickFreeOncomingX(-100);
                const first = {
                    x: firstX,
                    y: -100, w: Wcar, h: Hcar,
                    imgIdx: oppImages.current.length
                        ? Math.floor(Math.random() * oppImages.current.length)
                        : -1,
                    speed: rand(ONCOMING_MIN, ONCOMING_MAX) // если уже есть рандом скорости
                };
                obstaclesRef.current.push(first);


                // возможно второе
                if (Math.random() < extraProb) {
                    let x2 = pickFreeOncomingX(-180);
                    let tries = 0;
                    // чуть разводим по горизонтали с first, если получилось близко
                    while (Math.abs(x2 - first.x) < 70 && tries < 8) {
                        x2 = pickFreeOncomingX(-180);
                        tries++;
                    }

                    obstaclesRef.current.push({
                        x: x2,
                        y: -180, w: Wcar, h: Hcar,
                        imgIdx: oppImages.current.length
                            ? Math.floor(Math.random() * oppImages.current.length)
                            : -1,
                        speed: rand(ONCOMING_MIN, ONCOMING_MAX)
                    });
                }

                lastObsRef.current = ts;
            }

            // спавн попутных машин
            if (!lastSameRef.current) lastSameRef.current = ts;
            if (ts - lastSameRef.current > sameInterval) {
                const Wcar = 50, Hcar = 100;
                const rightMinX = W * 0.6;                         // начинаем с 60% ширины
                const rightRange = (W * 0.4) - Wcar;  
                let x = rightMinX + Math.random() * rightRange; // только правая половина

                let tries = 0;

                const overlapsAt = (xx, yy) => {
                    const ax1 = xx, ay1 = yy, ax2 = xx + Wcar, ay2 = yy + Hcar;
                    const hit = (bx, by, bw, bh) =>
                        !(ax2 <= bx || bx + bw <= ax1 || ay2 <= by || by + bh <= ay1);
                    return obstaclesRef.current.some(o => hit(o.x, o.y, o.w, o.h))
                        || sameDirRef.current.some(o => hit(o.x, o.y, o.w, o.h));
                };

                while (tries < 8 && overlapsAt(x, -120)) {
                    x = Math.random() * (W - Wcar);
                    tries++;
                }

                const imgIdx = oppImages.current.length
                    ? Math.floor(Math.random() * oppImages.current.length)
                    : -1;

                sameDirRef.current.push({
                    x, y: -120, w: Wcar, h: Hcar, imgIdx,
                    speed: rand(SAME_MIN, SAME_MAX)
                });
                lastSameRef.current = ts;
            }

            // спавн монет: интервал уменьшается со временем + иногда кидаем вторую монету
            if (!lastCoinRef.current) lastCoinRef.current = ts;
            if (ts - lastCoinRef.current > coinInterval) {
                const Wcoin = 30, Hcoin = 30, spawnY = -30;

                // вспомогательная проверка «плохих» пересечений около зоны спавна
                const badAtX = (cx, firstX = null) => {
                    // не лезем в машины и во вторую монету рядом
                    const overlapsObs =
                        obstaclesRef.current.some(o =>
                            o.y + o.h > spawnY &&
                            o.x < cx + Wcoin &&
                            o.x + o.w > cx
                        ) ||
                        sameDirRef.current.some(o =>
                            o.y + o.h > spawnY &&
                            o.x < cx + Wcoin &&
                            o.x + o.w > cx
                        );
                    const tooCloseFirst = firstX != null && Math.abs(cx - firstX) < 40;
                    return overlapsObs || tooCloseFirst;
                };

                // первая монета
                let firstX = 0;
                {
                    let tries = 0, cx = 0;
                    do {
                        cx = Math.random() * (W - Wcoin);
                        tries++;
                    } while (badAtX(cx) && tries < 12);
                    firstX = cx;
                    coinsRef.current.push({ x: cx, y: spawnY, w: Wcoin, h: Hcoin });
                }

                // возможно вторая монета
                if (Math.random() < extraCoinProbCoin) {
                    let tries = 0, cx2 = 0;
                    do {
                        cx2 = Math.random() * (W - Wcoin);
                        tries++;
                    } while (badAtX(cx2, firstX) && tries < 12);
                    coinsRef.current.push({ x: cx2, y: spawnY - 22, w: Wcoin, h: Hcoin }); // чуть выше, чтобы не слипались
                }

                lastCoinRef.current = ts;
            }

            // движение игрока — «едем» к targetX
            if (isFingerDownRef.current && targetXRef.current != null) {
                const carCenter = player.x + player.w / 2;
                const dx        = targetXRef.current - carCenter;
                if (Math.abs(dx) <= maxStepX) {
                    player.x += dx;
                } else {
                    player.x += Math.sign(dx) * maxStepX;
                }
                player.x = Math.max(0, Math.min(W - player.w, player.x));
            }

            // --- ВЕРТИКАЛЬНАЯ ФИЗИКА ИГРОКА ---
            // вверх по экрану — это уменьшение y; вниз — увеличение y
            const carCenterY = player.y + player.h / 2;

            if (isFingerDownRef.current && targetYRef.current != null) {
                const dy  = targetYRef.current - carCenterY; // >0: палец ниже, <0: палец выше
                const dir = Math.sign(dy) || 0;

                // если едем в ту же сторону, ускоряемся «газом», если меняем — тормозим сильнее
                const sameDir = dir === Math.sign(playerVy) || playerVy === 0;
                const a = sameDir ? ACCEL_UP : BRAKE_DN;

                // поддаём газ/тормоз к цели
                playerVy += dir * a * deltaSec;

                // чтобы не перелетать цель — оценим тормозной путь и начнём торможение заранее
                const stopDist = (playerVy * playerVy) / (2 * BRAKE_DN); // v^2/(2a)
                if (Math.abs(dy) < stopDist + 6) {
                    // тормозим навстречу скорости
                    const brakeDir = -Math.sign(playerVy);
                    playerVy += brakeDir * BRAKE_DN * deltaSec;
                }
            } else {
                // палец отпущен — естественное замедление к нулю
                if (playerVy > 0) {
                    playerVy = Math.max(0, playerVy - IDLE_DEC * deltaSec);
                } else if (playerVy < 0) {
                    playerVy = Math.min(0, playerVy + IDLE_DEC * deltaSec);
                }
            }

            // ограничение максималки
            playerVy = Math.max(-V_MAX, Math.min(V_MAX, playerVy));

            // интегрируем позицию
            player.y += playerVy * deltaSec;

            // границы по экрану (немного отступаем сверху/снизу)
            const topBound    = Math.max(10, H * 0.08);
            const bottomBound = H - player.h - Math.max(10, H * 0.08);
            if (player.y < topBound)   { player.y = topBound;   playerVy = 0; }
            if (player.y > bottomBound){ player.y = bottomBound; playerVy = 0; }

            // вычисляем «аналоговую» горизонтальную скорость и угол наклона
            const movedX      = player.x - prevPlayerX;
            // нормализуем к эквиваленту «px/кадр при 60 fps»
            const horizPer60  = movedX / factor;
            // доля от максимальной боковой скорости [-1..1]
            const ratio       = Math.max(-1, Math.min(1, horizPer60 / lateralSpeedBase));
            const targetTilt  = ratio * MAX_TILT;

            // лёгкое сглаживание, чтобы не дёргалось (учитываем factor)
            player.tilt += (targetTilt - player.tilt) * Math.min(1, 0.22 * factor);

            prevPlayerX = player.x;

            // движение мира (ускоряем со временем)
            obstaclesRef.current.forEach(o => {
                const mul = (o.speed ?? 1);
                o.y += forwardSpeedBase * factor * speedMult * mul;
            });
            sameDirRef.current.forEach(o => {
                const mul = (o.speed ?? 1);
                o.y += (forwardSpeedBase * factor * speedMult) * 0.5 * mul; // попутные в 2 раза медленнее
            });
            coinsRef.current.forEach(c    => c.y += forwardSpeedBase * factor * speedMult);

            // обновление флоутеров
            for (let i = floatersRef.current.length - 1; i >= 0; i--) {
                const f = floatersRef.current[i];
                f.t += delta;
                f.y += f.vy * deltaSec;
                if (f.t >= f.life) floatersRef.current.splice(i, 1);
            }

            // рендер сцены
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, W, H);

            // полосы (4 разделителя + анимация штрихов)
            ctx.strokeStyle = '#555';
            ctx.lineWidth   = 2;

            for (let i = 1; i < lanesCount; i++) {
                const x = i * laneW;

                if (i === 3) {
                    // третью рисуем как двойную СПЛОШНУЮ
                    ctx.save();
                    ctx.setLineDash([]);           // сплошная
                    ctx.lineDashOffset = 0;
                    const off = 3;                 // расстояние между двумя линиями
                    ctx.beginPath();
                    ctx.moveTo(x - off, 0);
                    ctx.lineTo(x - off, H);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(x + off, 0);
                    ctx.lineTo(x + off, H);
                    ctx.stroke();
                    ctx.restore();
                } else {
                    // остальные — пунктир и «едут»
                    ctx.save();
                    ctx.setLineDash([dash, gap]);
                    ctx.lineDashOffset = -roadDashOffRef.current;
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, H);
                    ctx.stroke();
                    ctx.restore();
                }
            }

            // препятствия (reverse + столкновения)
            for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
                const o = obstaclesRef.current[i];
                if (oppsLoaded && o.imgIdx >= 0) {
                    const img = oppImages.current[o.imgIdx];
                    if (img && img.complete) {
                        ctx.drawImage(img, o.x, o.y, o.w, o.h);
                    } else {
                        ctx.fillStyle = '#f00';
                        ctx.fillRect(o.x, o.y, o.w, o.h);
                    }
                    // DEBUG отрисовка хитбоксов
                    // drawHB(getHitbox(o, false), 'red');
                } else {
                    ctx.fillStyle = '#f00';
                    ctx.fillRect(o.x, o.y, o.w, o.h);
                }

                const hbP = getHitbox(player, true);
                const hbO = getHitbox(o, false);
                if (overlap(hbP, hbO)) endGame();

                if (o.y > H) obstaclesRef.current.splice(i, 1);
            }

            // попутные машины (reverse + столкновения, рисуем ПОВОРОТ НА 180°)
            for (let i = sameDirRef.current.length - 1; i >= 0; i--) {
                const o = sameDirRef.current[i];

                if (oppsLoaded && o.imgIdx >= 0) {
                    const img = oppImages.current[o.imgIdx];
                    if (img && img.complete) {
                        ctx.save();
                        // поворачиваем вокруг центра машины
                        ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
                        ctx.rotate(Math.PI);
                        ctx.drawImage(img, -o.w / 2, -o.h / 2, o.w, o.h);
                        ctx.restore();
                    } else {
                        ctx.fillStyle = '#cc0';
                        ctx.fillRect(o.x, o.y, o.w, o.h);
                    }
                } else {
                    ctx.fillStyle = '#cc0';
                    ctx.fillRect(o.x, o.y, o.w, o.h);
                }

                // столкновение — конец игры
                const hbP2 = getHitbox(player, true);
                const hbS  = getHitbox(o, false);
                if (overlap(hbP2, hbS)) endGame();

                // чистим, если вышли за экран
                if (o.y > H) sameDirRef.current.splice(i, 1);
            }

            // монеты (reverse + сбор) + флоутер
            for (let i = coinsRef.current.length - 1; i >= 0; i--) {
                const c  = coinsRef.current[i];
                const cx = c.x + c.w / 2;
                const cy = c.y + c.h / 2;
                const r  = c.w / 2;

                const g = ctx.createRadialGradient(cx - r / 3, cy - r / 3, r / 4, cx, cy, r);
                g.addColorStop(0, '#FFE066');
                g.addColorStop(0.5, '#FFC233');
                g.addColorStop(1, '#D9A400');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#8A6E00';
                ctx.lineWidth   = 2;
                ctx.stroke();

                ctx.fillStyle    = '#1a1a1a';
                ctx.font         = `bold ${Math.floor(r * 1.2)}px Inter, system-ui, sans-serif`;
                ctx.textAlign    = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('$', cx, cy + r * 0.06);

                if (
                    c.x < player.x + player.w &&
                    c.x + c.w > player.x &&
                    c.y < player.y + player.h &&
                    c.y + c.h > player.y
                ) {
                    // сколько стоит монета прямо сейчас
                    const gain = coinValueRef.current;

                    scoreRef.current += gain;
                    setScore(scoreRef.current);

                    // апдейтим суммарный заработок и пересчитываем уровень/номинал по прогрессии 1000,1500,2000,...
                    totalEarnedRef.current += gain;
                    setTotalEarned(totalEarnedRef.current);
                    localStorage.setItem('arcadeTotalEarned', String(totalEarnedRef.current));

                    const info = coinLevelFromTotal(totalEarnedRef.current);
                    if (info.level !== coinLevelRef.current) {
                        coinLevelRef.current = info.level;
                        const newValue = COIN_BASE + info.level * COIN_STEP;
                        coinValueRef.current = newValue;
                        setCoinLevel(info.level);
                        setCoinValue(newValue);
                    }

                    // звук монетки — пул уже есть
                    const pool = coinPoolRef.current;
                    if (!muted && pool && pool.length) {
                        const i = coinPoolIdxRef.current % pool.length;
                        coinPoolIdxRef.current = (i + 1) % pool.length;
                        const a = pool[i];
                        try {
                            a.currentTime = 0;
                            a.play().catch(() => {});
                        } catch {}
                    }

                    // зачислить деньги немедленно
                    try { add(gain); } catch {}

                    // флоутер с актуальной суммой
                    floatersRef.current.push({
                        x: cx, y: cy, vy: -120, life: 650, t: 0, text: `+${gain}$`
                    });

                    coinsRef.current.splice(i, 1);
                }
                if (c.y > H) coinsRef.current.splice(i, 1);
            }

            // флоутеры
            for (const f of floatersRef.current) {
                const alpha = Math.max(0, 1 - f.t / f.life);
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.fillStyle   = '#99802C';
                ctx.strokeStyle = '#000';
                ctx.lineWidth   = 3;
                ctx.font        = 'bold 22px Inter, system-ui, sans-serif';
                ctx.textAlign   = 'center';
                ctx.textBaseline= 'middle';
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur  = 6;
                ctx.shadowOffsetY = 2;
                const txt = f.text || '+10$';
                ctx.strokeText(txt, f.x, f.y);
                ctx.fillText(txt, f.x, f.y);
                ctx.restore();
            }

            // игрок
            const px = player.x + player.w / 2;
            const py = player.y + player.h / 2;
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(player.tilt || 0);
            if (carLoaded) {
                ctx.drawImage(carImage.current, -player.w / 2, -player.h / 2, player.w, player.h);
            } else {
                ctx.fillStyle = '#4F4E4F';
                ctx.fillRect(-player.w / 2, -player.h / 2, player.w, player.h);
            }
            // DEBUG отрисовка хитбоксов
            // drawHB(getHitbox(player, true), 'red');
            ctx.restore();

            animId = requestAnimationFrame(loop);
        };

        animId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animId);
    }, [gameOver, carLoaded, oppsLoaded, started]);

    // Telegram BackButton
    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (tg?.BackButton) {
            tg.BackButton.show();
            tg.BackButton.onClick(() => {
                navigate('/', { replace: true });
            });
        }
        return () => {
            if (tg?.BackButton) {
                tg.BackButton.offClick();
                tg.BackButton.hide();
            }
        };
    }, [navigate]);

    useEffect(() => {
        const saved = localStorage.getItem('arcadeMuted');
        if (saved != null) setMuted(saved === '1');
    }, []);

    useEffect(() => {
        if (crashSndRef.current) {
            crashSndRef.current.muted  = muted;
            crashSndRef.current.volume = muted ? 0 : baseVolRef.current.crash;
        }
        if (coinPoolRef.current && coinPoolRef.current.length) {
            coinPoolRef.current.forEach(a => {
                a.muted  = muted;
                a.volume = muted ? 0 : baseVolRef.current.coin;
            });
        }
        try { localStorage.setItem('arcadeMuted', muted ? '1' : '0'); } catch {}
    }, [muted]);

    // Улучшение монетки
    useEffect(() => {
        const saved = Number(localStorage.getItem('arcadeTotalEarned') || 0);
        totalEarnedRef.current = saved;
        const info = coinLevelFromTotal(saved);

        coinLevelRef.current = info.level;
        coinValueRef.current = COIN_BASE + info.level * COIN_STEP;

        setTotalEarned(saved);
        setCoinLevel(info.level);
        setCoinValue(COIN_BASE + info.level * COIN_STEP);
    }, []);

    // Добавление звуков
    useEffect(() => {
        // crash — один объект
        const crash = new Audio(sfxCrash);
        crash.preload = 'auto';
        crash.volume  = baseVolRef.current.crash;
        crashSndRef.current = crash;

        // пул монеток, чтобы управлять mute у всех и не плодить клоны
        const poolSize = 6;
        const pool = [];
        for (let i = 0; i < poolSize; i++) {
            const a = new Audio(sfxCoin);
            a.preload = 'auto';
            a.volume  = baseVolRef.current.coin;
            pool.push(a);
        }
        coinPoolRef.current = pool;
        coinPoolIdxRef.current = 0;

        // Разблокировка на мобильных — прогоняем crash и КАЖДУЮ монетку
        const tryPlayPause = a => {
            a.muted = true;
            a.play().then(() => {
                a.pause();
                a.currentTime = 0;
                a.muted = false;
            }).catch(() => {});
        };
        const unlock = () => {
            tryPlayPause(crash);
            pool.forEach(tryPlayPause);
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('touchstart', unlock);
        };
        window.addEventListener('pointerdown', unlock, { once: true });
        window.addEventListener('touchstart', unlock,   { once: true });

        return () => {
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('touchstart', unlock);
        };
    }, []);

    // жесты: держим палец — едем к targetX
    const getPoint = e => {
        const t = e?.touches ? e.touches[0] : e;
        return { x: t.clientX, y: t.clientY };
    };

    const handlePointerDown = e => {
        const { x, y } = getPoint(e);
        isFingerDownRef.current = true;
        targetXRef.current = x;
        targetYRef.current = y;  // цель по вертикали
        if (e.pointerId != null) e.currentTarget.setPointerCapture(e.pointerId);
    };
    const handlePointerMove = e => {
        if (!isFingerDownRef.current) return;
        const { x, y } = getPoint(e);
        targetXRef.current = x;
        targetYRef.current = y;  // обновляем цель по вертикали
    };
    const handlePointerUp = e => {
        isFingerDownRef.current = false;
        targetXRef.current = null;
        targetYRef.current = null; // отпустили «газ/тормоз»
        if (e.pointerId != null) {
            try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
        }
    };

    const handleToggleMute = () => {
        setMuted(prev => {
            const next = !prev;

            // применяем к громкости/мьюту сразу
            if (crashSndRef.current) {
                crashSndRef.current.muted  = next;
                crashSndRef.current.volume = next ? 0 : baseVolRef.current.crash;
            }
            if (coinPoolRef.current && coinPoolRef.current.length) {
                coinPoolRef.current.forEach(a => {
                    a.muted  = next;
                    a.volume = next ? 0 : baseVolRef.current.coin;
                });
            }

            // если ВКЛЮЧАЕМ звук — праймим все инстансы в обработчике клика
            if (!next) {
                const all = [
                    crashSndRef.current,
                    ...(coinPoolRef.current || [])
                ].filter(Boolean);

                all.forEach(a => {
                    try {
                        a.currentTime = 0;
                        a.play()
                            .then(() => {
                                a.pause();
                                a.currentTime = 0;
                            })
                            .catch(() => {});
                    } catch {}
                });
            }

            // запомним состояние
            try { localStorage.setItem('arcadeMuted', next ? '1' : '0'); } catch {}
            return next;
        });
    };

    // старт игры: ставим картинку игрока из carsData.imageArcade
    const startGame = () => {
        startTimeRef.current = performance.now();
        elapsedMsRef.current = 0;

        if (!selectedCar) {
            setStarted(true);
            return;
        }

        const fullCarData = carsData.find(m => m.id === selectedCar.carId);
        const arcadeImage = fullCarData?.imageArcade || fullCarData?.image || carImgSrc;

        const coef = Number(fullCarData?.arcadeAccel ?? 1);

        // Учитываем фактическое состояние купленного авто
        const cond = selectedCar?.condition || {};
        const keys = ['engine', 'transmission', 'suspension', 'body', 'electrics', 'interior'];
        const avg = keys.reduce((s, k) => s + (Number(cond[k]) || 0), 0) / keys.length || 0; // 0..100
        const health = Math.max(0.4, Math.min(1, avg / 100)); // защита: не ниже 40%

        // Разгон деградирует сильнее, максималка — мягче
        const accelK = 0.5 + 0.5 * health; // 0.5..1.0
        const vmaxK  = 0.6 + 0.4 * health; // 0.6..1.0

        accelUpRef.current = 1100 * coef * accelK;
        vMaxRef.current    = 520  * (0.9 + 0.4 * coef) * vmaxK;

        setStarted(true); // скрываем шторку сразу

        setCarLoaded(false);
        const img = new Image();
        img.onload = () => {
            carImage.current = img;
            setCarLoaded(true);
        };
        img.onerror = () => {
            const fallback = new Image();
            fallback.onload = () => {
                carImage.current = fallback;
                setCarLoaded(true);
            };
            fallback.src = carImgSrc;
        };
        img.src = arcadeImage;
    };

    function t00100FromCoef(coef) {
        const base = 8.0; // базовая «средняя» машина ≈ 8.0 с
        const t = base / (coef || 1);
        return Math.max(3.2, Math.min(20.0, t)); // легкий здравый диапазон
    }

    return (
        <>
            <div className="arcade-header">
                <span className="arcade-score">Счёт ${score}</span>
            </div>

            <button
                className="mute-btn"
                onClick={handleToggleMute}
                aria-label={muted ? 'Включить звук' : 'Выключить звук'}
                title={muted ? 'Звук выключен' : 'Звук включён'}
            >
                {muted ? <FaVolumeMute /> : <FaVolumeUp />}
            </button>

            <canvas
                ref={canvasRef}
                className="arcade-canvas"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
            />

            {/* Стартовая шторка выбора авто */}
            {!started && !gameOver && (
                <div className="start-overlay">
                    <div className="start-sheet">
                        <div className="sheet-handle" />
                        <div className="sheet-title">Выберите автомобиль</div>

                        {availableCars.length === 0 ? (
                            <div className="empty-box">
                                <p>Нет доступных авто в ожидании.</p>
                                <button className="exit-btn" onClick={() => navigate('/service')}>
                                    В гараж
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="car-list">
                                    {availableCars.map(car => {
                                        const full = carsData.find(m => m.id === car.carId);
                                        const cond = car.condition || {};
                                        const keys = ['engine', 'transmission', 'suspension', 'body', 'electrics', 'interior'];
                                        const avg = keys.reduce((s, k) => s + (Number(cond[k]) || 0), 0) / keys.length || 0;
                                        const health = Math.max(0.4, Math.min(1, avg / 100));
                                        const effCoef = (Number(full?.arcadeAccel ?? 1)) * (0.5 + 0.5 * health);
                                        const t00100 = t00100FromCoef(effCoef).toFixed(1);
                                        return (
                                            <button
                                                key={car.id}
                                                className={`car-option ${selectedCar?.id === car.id ? 'selected' : ''}`}
                                                onClick={() => setSelectedCar(car)}
                                            >
                                                <img src={car.image} alt={car.name} />
                                                <div className="car-meta">
                                                    <div className="name">{car.name}</div>
                                                    {/* <div className="price">$ {car.price.toLocaleString('ru-RU')}</div> */}
                                                    <div className="t00100">0–100 км/ч: {t00100} с</div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                
                                <div className="sheet-title">Улучшения</div>
                                <div className="coin-upgrade">
                                    <div className="coin-line">
                                        <span>Монета:</span> <strong>+{coinValue}$</strong>
                                        <span className="dot">•</span>
                                        <span>Уровень: {coinLevel}</span>
                                    </div>
                                    <div className="coin-sub">
                                        Всего заработано: ${totalEarned.toLocaleString('ru-RU')}
                                    </div>
                                    <div className="coin-progress-wrap">
                                        {(() => {
                                            const info = coinLevelFromTotal(totalEarned);
                                            const pct = Math.max(0, Math.min(100, Math.round(info.progress * 100)));
                                            return (
                                                <>
                                                    <div className="coin-sub" style={{ marginTop: 4 }}>
                                                        Прогресс до улучшения: ${info.earnedInLevel.toLocaleString('ru-RU')}
                                                        {' '}из ${info.currentReq.toLocaleString('ru-RU')}
                                                    </div>
                                                    <div className="coin-progress">
                                                        <div className="bar" style={{ width: `${pct}%` }} />
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>

                                <button
                                    className="play-primary"
                                    onClick={startGame}
                                    disabled={!selectedCar}
                                >
                                    Играть
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {gameOver && (
                <div className="gameover-overlay overlay-animate">
                    <div className="gameover-box box-animate">
                        <div className="arcade-balance-pill">
                            <span>Баланс</span>
                            <strong>$ {formatMoney(balance)}</strong>
                        </div>

                        <h2>Игра окончена</h2>

                        <p>Вы заработали: <strong>${score}</strong></p>
                        <p>Время: <strong>{formatTime(summary.timeMs)}</strong></p>

                        {(summary.isScoreRecord || summary.isTimeRecord) ? (
                            <p style={{ color: '#5aa9ff', marginTop: 6 }}>
                                🎉 {summary.isScoreRecord && summary.isTimeRecord
                                    ? 'Новый рекорд по счёту и времени!'
                                    : summary.isScoreRecord
                                        ? 'Новый рекорд по счёту!'
                                        : 'Новый рекорд по времени!'}
                            </p>
                        ) : (
                            <p style={{ color: '#ccc', marginTop: 6 }}>
                                Рекорды: счёт — ${summary.bestScore}, время — {formatTime(summary.bestTimeMs)}
                            </p>
                        )}

                        <button className="play-again-btn" onClick={resetGame}>
                            Играть снова
                        </button>
                        <button className="exit-btn" onClick={() => { navigate('/', { replace: true }); }}>
                            Выход
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
