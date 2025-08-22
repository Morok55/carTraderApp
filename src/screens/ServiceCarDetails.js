import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import '../css/carDetails.css';
import carsData from '../data/carsData';
import CarInfo from '../components/CarInfo';
import { useBalance } from '../balance';
import { TbEngine } from "react-icons/tb";
import { MdOutlineSettings, MdElectricBolt } from "react-icons/md";
import { GiCarWheel } from "react-icons/gi";
import { FaCarSide, FaRegClock } from "react-icons/fa";
import { PiSeatBold } from "react-icons/pi";

const PURCHASED_KEY = 'purchasedCars';

const PRICE_PER_POINT = {
    engine: 25, transmission: 20, suspension: 15,
    body: 10, electrics: 12, interior: 8,
};

const MINUTES_PER_POINT = {
    engine: 0.25, transmission: 0.20, suspension: 0.16,
    body: 0.12, electrics: 0.14, interior: 0.10,
};

const PART_META = {
    engine: { label: 'Двигатель', Icon: TbEngine },
    transmission: { label: 'Трансмиссия', Icon: MdOutlineSettings },
    suspension: { label: 'Ходовая часть', Icon: GiCarWheel },
    body: { label: 'Кузов и ЛКП', Icon: FaCarSide },
    electrics: { label: 'Электрика', Icon: MdElectricBolt },
    interior: { label: 'Салон', Icon: PiSeatBold },
};

const SHOWROOM_KEY = 'showroomCars';
const SHOWROOM_CAPACITY_KEY = 'showroomCapacity';
function loadShowroom() {
    try { return JSON.parse(localStorage.getItem(SHOWROOM_KEY) || '[]'); }
    catch { return []; }
}
function saveShowroom(arr) {
    localStorage.setItem(SHOWROOM_KEY, JSON.stringify(arr));
}

function readShowroomCap() {
    try { return Number(localStorage.getItem(SHOWROOM_CAPACITY_KEY)) || 5; } catch { return 5; }
}
function notifyCapacity(title, message) {
    const wa = window.Telegram && window.Telegram.WebApp;
    const canPopup = !!(wa && typeof wa.showPopup === 'function' && typeof wa.isVersionAtLeast === 'function' && wa.isVersionAtLeast('6.2'));
    if (canPopup) {
        try { wa.showPopup({ title, message }); return; } catch (e) {}
    }
    alert(message);
}

const fmtPrice = n => `$ ${(Number.isFinite(n) ? n : 0).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
})}`;

const fmtDur = mins => {
    const m = Math.max(0, Math.round(mins));
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h} ч. ${mm} мин.`;
};

function getBase(car) {
    return (
        car?.basePrice ??
        carsData.find(m => m.id === car?.carId)?.basePrice ??
        car?.purchasePrice ??
        car?.price ?? 0
    );
}
function estimateMarketValue(car) {
    const avg = Object.values(car.condition || {}).reduce((a, b) => a + b, 0) / 6;
    const base = getBase(car);
    return Math.round(base * (avg / 100));
}
function loadPurchased() {
    try { return JSON.parse(localStorage.getItem(PURCHASED_KEY) || '[]'); } catch { return []; }
}
function savePurchased(list) {
    localStorage.setItem(PURCHASED_KEY, JSON.stringify(list));
}

// ──────────────── расчёт ремонта ────────────────
function avgConditionOf(car) {
    return Object.values(car.condition || {}).reduce((a, b) => a + b, 0) / 6;
}

function globalPenalty(avg, base) {
    const norm = avg / 100;
    let factor = 1 + 2.2 * Math.pow(0.5 - norm, 2);
    if (avg < 25) factor += 0.4 * (0.25 - norm);
    if (avg > 75) factor += 0.15 * (norm - 0.75);
    if (base < 8000) factor *= 0.7;
    return Math.max(0.85, factor);
}

/**
 * Агрессивная шкала стоимости по базовой цене модели:
 *   15k  → ~1.0×
 *   36k  → ~2.5×
 *  100k  → ~5.5×
 *  300k  → ~9.5×
 *  500k  → ~12.0×
 * 1000k  → ~15.5×
 */
function priceScaleByBase(base) {
    const minB = 12000;
    const maxB = 1200000;
    const b = Math.min(maxB, Math.max(minB, Number(base) || 0));

    const tLin = (b - minB) / (maxB - minB); // 0..1 линейно
    const tLog = (Math.log(b) - Math.log(minB)) / (Math.log(maxB) - Math.log(minB)); // 0..1 логарифмически

    // сочетание логарифмического и линейного роста, чтобы верх сильно дорожал
    const scale = 0.8 + 6.0 * tLin + 10.0 * Math.pow(tLog, 1.35);
    return scale; // 0.8..≈15.8
}

/**
 * Люксовая надбавка для дорогих машин
 *  ≥ 80k → +10%, ≥150k → +25%, ≥300k → +45%, ≥500k → +65%
 */
function luxuryFactor(base) {
    if (base >= 500000) return 1.65;
    if (base >= 300000) return 1.45;
    if (base >= 150000) return 1.25;
    if (base >= 80000)  return 1.10;
    return 1.0;
}

function computeRepairCost(car, selectedParts) {
    const base = getBase(car);

    const scale = priceScaleByBase(base) * luxuryFactor(base);

    // чем дороже авто, тем «круче» растёт цена за каждый недостающий процент состояния
    const severityExp = 1.5 + Math.min(0.5, (Math.max(0, base - 80000) / 420000) * 0.5);
    // 80k → ~1.5, 300k → ~1.86, 500k → ~2.0

    const avg = avgConditionOf(car);
    const gPenalty = globalPenalty(avg, base);

    let cost = 0;
    let mins = 0;
    let partsCount = 0;

    Object.keys(PART_META).forEach(k => {
        if (!selectedParts[k]) return;
        partsCount++;

        const curr = car.condition?.[k] ?? 0;
        const need = Math.max(0, 100 - curr); // сколько % добрать до 100

        const severity = Math.pow(need / 100, severityExp);

        // базовая ставка узла, усиленная ценой модели и «люксовостью»
        let perPoint = (PRICE_PER_POINT[k] || 10) * scale * (0.7 + 1.0 * severity);

        // минимальная ставка на премиуме, чтобы не было «копеек» за сложные узлы
        if (base >= 300000) {
            const floor = 35; // $ за 1% состояния
            if (perPoint < floor) perPoint = floor;
        }

        cost += need * perPoint;
        mins += need * (MINUTES_PER_POINT[k] || 0.5);
    });

    // оверхеды: диагностика/снятие-установка/мелочи растут с ценой модели
    const jobSetup = 120 + base * 0.02;                   // 12k → ~360; 500k → ~10k
    const perPartFee = partsCount * (20 + base * 0.004);  // 6 узлов: 12k → ~408; 500k → ~12k

    cost = (cost + jobSetup + perPartFee) * gPenalty;

    return { cost: Math.round(cost), mins };
}
// ────────────────────────────────────────────────



// оценка длительности продажи по выбранной цене
function saleDurationMins(chosenPrice, marketValue) {
    if (!marketValue || chosenPrice <= 0) return 0;
    const r = chosenPrice / marketValue; // коэффициент к рыночной

    // ≤ -10% → мгновенно
    if (r <= 0.90) return 0;

    // -10%..0%: 0 → 60 мин (линейно)
    if (r < 1.00) return Math.round((r - 0.90) / 0.10 * 60);

    // 0%..+10%: 60 → 180 мин (ровно 3 часа на +10%)
    if (r <= 1.10) return Math.round(60 + (r - 1.00) / 0.10 * 120);

    // > +10% (на всякий случай, если где-то появится больше 110%)
    // продолжаем плавно от 180 мин, без скачка
    const extra = (r - 1.10) / 0.20; // 0..1 при 1.10..1.30
    return Math.round(180 + Math.pow(Math.min(1, Math.max(0, extra)), 2) * 300); // 180..480
}


export default function ServiceCarDetails() {
    const { spend, add, canAfford } = useBalance();
    const navigate = useNavigate();
    const { state } = useLocation();
    const { id } = useParams();

    const [car, setCar] = useState(() => {
        if (state) return state;
        const all = loadPurchased();
        return all.find(c => String(c.id) === String(id)) || null;
    });
    const [selected, setSelected] = useState({});
    const [now, setNow] = useState(Date.now());

    const [sellOpen, setSellOpen] = useState(false);
    const [sellPct, setSellPct] = useState(100);

    const [sellClosing, setSellClosing] = useState(false);
    const MODAL_MS = 200;

    function openSellModal() {
        setSellPct(100);
        setSellClosing(false);
        setSellOpen(true);
    }

    function closeSellModal() {
        setSellClosing(true);
        setTimeout(() => {
            setSellOpen(false);
            setSellClosing(false);
        }, MODAL_MS);
    }
    
    useEffect(() => {
        // Прокрутка в начало при открытии страницы
        // window.scrollTo(0, 0);
        // setTimeout(() => {
        //     window.scrollTo(0, 0)
        // }, 200)

        const tg = window.Telegram?.WebApp;
        tg?.BackButton?.show();
        tg?.BackButton?.onClick(() => {
            navigate('/service', { replace: true });
        });

        return () => {
            tg?.BackButton?.offClick?.();
            tg?.BackButton?.hide?.();
        };
    }, [navigate]);

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    // превью стоимости/времени
    const { totalCost, totalMins } = useMemo(() => {
    if (!car) return { totalCost: 0, totalMins: 0 };
        const res = computeRepairCost(car, selected);
        return { totalCost: res.cost, totalMins: res.mins };
    }, [selected, car]);

    const activeSale = car?.activeSale || null;

    const active = car?.activeRepair || null;
    const remainingMs = active ? Math.max(0, active.endAt - now) : 0;
    const remainingMins = Math.ceil(remainingMs / 60000);

    const remainingSaleMs = activeSale ? Math.max(0, activeSale.endAt - now) : 0;
    const remainingSaleMins = Math.ceil(remainingSaleMs / 60000);

    useEffect(() => {
        if (active && remainingMs <= 0) finishRepair();
    }, [active, remainingMs]);

    useEffect(() => {
        if (activeSale && remainingSaleMs <= 0) {
            // продажа завершена → зачисляем деньги, удаляем авто и уходим в список сервиса
            if (activeSale.price) add(activeSale.price);
            const all = loadPurchased();
            const filtered = all.filter(c => String(c.id) !== String(car.id));
            savePurchased(filtered);
            navigate('/', { replace: true });
        }
    }, [activeSale, remainingSaleMs, car?.id, navigate]);

    if (!car) {
        return <div className="serviced-car-page"><p style={{ padding: 16 }}>Машина не найдена</p></div>;
    }

    const toggle = (k) => setSelected(p => ({ ...p, [k]: !p[k] }));
    const startRepair = () => {
        if (!Object.values(selected).some(Boolean)) return;
        const { cost, mins } = computeRepairCost(car, selected);

        // списываем деньги за ремонт
        if (!spend(Math.max(0, Math.round(cost)))) return;

        const endAt = Date.now() + Math.max(1, Math.ceil(mins)) * 60000;
        const updated = {
            ...car,
            status: 'inProgress',
            activeRepair: {
                endAt,
                cost,
                parts: Object.keys(selected).filter(k => selected[k])
            }
        };
        const all = loadPurchased();
        const idx = all.findIndex(c => String(c.id) === String(updated.id));
        if (idx >= 0) { all[idx] = updated; savePurchased(all); }
        setCar(updated);
        setSelected({});
    };
    const skipRepair = () => {
        if (!active) return;
        finishRepair({ ...car, activeRepair: { ...active, endAt: Date.now() } }, { ...active, endAt: Date.now() });
    };

    function finishRepair(targetCar = car, activeRepair = active) {
        if (!targetCar || !activeRepair) return;
        const updated = { ...targetCar, condition: { ...targetCar.condition } };
        let invested = updated.repairInvested || 0;
        const planned = Math.max(0, Math.round(activeRepair.cost ?? 0));

        (activeRepair.parts || []).forEach(k => {
            updated.condition[k] = 100;
        });

        updated.repairInvested = invested + planned;
        if (typeof updated.purchasePrice !== 'number') {
            updated.purchasePrice = updated.price;
        }
        delete updated.activeRepair;
        updated.status = 'waiting';

        const all = loadPurchased();
        const idx = all.findIndex(c => String(c.id) === String(updated.id));
        if (idx >= 0) {
            all[idx] = updated;
            savePurchased(all);
        }
        setCar(updated);
    }

    function confirmSell() {
        if (!car) return;

        const minutes = Math.max(0, chosenMins);

        if (minutes === 0) {
            const all = loadPurchased();
            const filtered = all.filter(c => String(c.id) !== String(car.id));
            savePurchased(filtered);

            add(chosenPrice);

            navigate('/', { replace: true });
            return;
        }

        const cap = readShowroomCap();
        const showroom = loadShowroom();
        if (showroom.length >= cap) {
            notifyCapacity('Зал заполнен', `Выставочный зал заполнен (${showroom.length}/${cap}). Освободите место или увеличьте вместимость.`);
            return;
        }

        const saleItem = {
            id: car.id,
            carId: car.carId,
            name: car.name,
            image: car.image,
            price: chosenPrice,
            startAt: Date.now(),
            endAt: Date.now() + minutes * 60000,
            totalMins: minutes,
            purchasePaid: purchasePaid,
            invested: invested
        };

        const all = loadPurchased();
        const filtered = all.filter(c => String(c.id) !== String(car.id));
        savePurchased(filtered);

        showroom.push(saleItem);
        saveShowroom(showroom);

        navigate('/', { replace: true });
    }

    // сколько реально заплатили при покупке (без витринной)
    const purchasePaid = (car.purchasePrice ?? car.price ?? 0);
    // что показывать в статистике строкой «Стоимость покупки»
    const purchaseShown = (typeof car.marketPrice === 'number' ? car.marketPrice : purchasePaid);

    const invested = car.repairInvested || 0;
    const marketValue = estimateMarketValue(car);

    const chosenPrice = Math.round(marketValue * (sellPct / 100));
    const chosenMins  = saleDurationMins(chosenPrice, marketValue);
    const netAtChosen = chosenPrice - purchasePaid - invested;

    // продаём по полной рыночной цене
    const sellValue = marketValue;

    const net = sellValue - purchasePaid - invested;

    const parts = [
        { key: 'engine', label: 'Двигатель', icon: <TbEngine /> },
        { key: 'transmission', label: 'Трансмиссия', icon: <MdOutlineSettings /> },
        { key: 'suspension', label: 'Ходовая часть', icon: <GiCarWheel /> },
        { key: 'body', label: 'Кузов и ЛКП', icon: <FaCarSide /> },
        { key: 'electrics', label: 'Электрика', icon: <MdElectricBolt /> },
        { key: 'interior', label: 'Салон', icon: <PiSeatBold /> },
    ];

    return (
        <div className="serviced-car-page">
            <CarInfo car={{ ...car, price: marketValue }} parts={parts} />

            {active && remainingMs > 0 ? (
                <div className="repair-job">
                    <div className="job-card">
                        <div className="job-title"><FaRegClock className='icon-repair' /> Ремонтные работы</div>
                        <div className="job-icon-list">
                            {(active.parts || []).map(p => {
                                const Icon = PART_META[p]?.Icon;
                                return <span key={p} className="job-part">{Icon ? <Icon /> : p}</span>;
                            })}
                        </div>
                        <div className="job-remaining">{fmtDur(remainingMins)}</div>
                        <div className="job-remaining-sub">Оставшееся время</div>
                        {/* <button className="job-btn skip-btn" onClick={skipRepair}>Пропустить</button> */}
                    </div>
                </div>
            ) : (
                <div className="repair-panel">
                    <div className="repair-panel__title">Ремонт</div>
                    <div className="repair-icons">
                        {Object.entries(PART_META).map(([key, meta]) => {
                            const Icon = meta.Icon;
                            const activeBtn = !!selected[key];
                            const disabled = (car.condition?.[key] ?? 0) >= 100;
                            return (
                                <button
                                    key={key}
                                    className={`repair-icon ${activeBtn ? 'is-active' : ''} ${disabled ? 'is-disabled' : ''}`}
                                    onClick={() => !disabled && toggle(key)}
                                >
                                    <Icon />
                                </button>
                            );
                        })}
                    </div>
                    <div className="repair-meta">
                        <div className="repair-meta__row"><span className="label">Стоимость:</span><span className="value">{fmtPrice(totalCost)}</span></div>
                        <div className="repair-meta__row"><span className="label">Длительность:</span><span className="value">{fmtDur(totalMins)}</span></div>
                    </div>
                    <button
                        className={`repair-start ${
                            Object.values(selected).some(Boolean) && canAfford(totalCost) ? '' : 'is-disabled'
                        }`}
                        onClick={startRepair}
                    >
                        Начать ремонт
                    </button>
                </div>
            )}

            <div className="stats">
                <div className="stats__title">Статистика</div>
                <div className="stats__row"><span>Стоимость покупки:</span><span className="stats__num">{fmtPrice(purchaseShown)}</span></div>
                <div className="stats__row"><span>Вложено в ремонт:</span><span className="stats__num">{fmtPrice(invested)}</span></div>
                <div className="stats__row"><span>Рыночная стоимость:</span><span className="stats__num">{fmtPrice(marketValue)}</span></div>
                <hr className="stats__divider" />
                <div className={`stats__row stats__net ${net >= 0 ? 'pos' : 'neg'}`}><span>Чистый доход:</span><span className="stats__num">{fmtPrice(Math.abs(net))}</span></div>
                <button className="sell-button" onClick={openSellModal}>Выставить на продажу</button>
            </div>

            {sellOpen && !activeSale && (
                <div className={`modal-backdrop ${sellClosing ? 'fade-out' : 'fade-in'}`} onClick={closeSellModal}>
                    <div className={`modal-card ${sellClosing ? 'pop-out' : 'pop-in'}`} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-title">Продажа {car.name}</div>

                        <div className="modal-row">
                            <div className="price-line">
                                <span className="pill">-10%</span>
                                <span className="pill pill--primary">Рыночная {fmtPrice(marketValue)}</span>
                                <span className="pill">+10%</span>
                            </div>

                            <input
                                type="range"
                                min="90" max="110" step="1"
                                value={sellPct}
                                onChange={(e) => setSellPct(parseInt(e.target.value, 10))}
                                className="slider"
                                aria-label="Цена продажи в % от рыночной"
                            />

                            <div className="sell-meta">
                                <div className="sell-meta__row">
                                    <span>Выбранная цена:</span>
                                    <span className="sell-meta__num">{fmtPrice(chosenPrice)} ({sellPct}%)</span>
                                </div>
                                <div className="sell-meta__row">
                                    <span>Чистый доход:</span>
                                    <span className={`sell-meta__num ${netAtChosen >= 0 ? 'pos' : 'neg'}`}>
                                        {fmtPrice(netAtChosen)}
                                    </span>
                                </div>
                                <div className="sell-meta__row">
                                    <span>Время продажи:</span>
                                    <span className="sell-meta__num">{chosenMins <= 0 ? 'Мгновенно' : fmtDur(chosenMins)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button className="btn btn-ghost" onClick={closeSellModal}>Отмена</button>
                            <button className="btn btn-primary" onClick={confirmSell}>Подтвердить</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
