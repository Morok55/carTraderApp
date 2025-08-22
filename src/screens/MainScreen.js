import React, { useEffect, useState } from 'react';
import { MdCarRepair } from "react-icons/md";
import { IoMdSettings } from "react-icons/io";
import { FaRegClock } from "react-icons/fa";
import { FaWrench } from "react-icons/fa";
import { PiGarageBold } from "react-icons/pi";  
import { FaCoins } from "react-icons/fa";
import { FaCar } from "react-icons/fa";
import { FaScrewdriverWrench } from "react-icons/fa6";
import { PiGarage } from "react-icons/pi";
import { GiSkills } from "react-icons/gi";
import { useNavigate } from 'react-router-dom';
import { FaPlay } from "react-icons/fa";

import { useBalance, formatMoney } from '../balance';


const SHOWROOM_KEY = 'showroomCars';
function loadShowroom() {
    try { return JSON.parse(localStorage.getItem(SHOWROOM_KEY) || '[]'); }
    catch { return []; }
}

const SPEC_CURRENT_KEY = 'specCurrent';
const SPEC_CHANGE_KEY  = 'specChange';
function readSpecCurrent() {
    try { return localStorage.getItem(SPEC_CURRENT_KEY) || 'mass'; } catch { return 'mass'; }
}
function readSpecChange() {
    try { return JSON.parse(localStorage.getItem(SPEC_CHANGE_KEY) || 'null'); } catch { return null; }
}
function writeSpecCurrent(val) {
    try { localStorage.setItem(SPEC_CURRENT_KEY, val); } catch {}
}
function clearSpecChange() {
    try { localStorage.removeItem(SPEC_CHANGE_KEY); } catch {}
}


function MainScreen() {
    const { balance, add } = useBalance();
    const navigate = useNavigate();
    const [waitingCount, setWaitingCount] = useState(0);
    const [inProgressCount, setInProgressCount] = useState(0);
    const [usedPercent, setUsedPercent] = useState(0);

    const [showroomCount, setShowroomCount] = useState(0);
    const [showroomSum, setShowroomSum] = useState(0);

    const SERVICE_CAPACITY_KEY = 'serviceCapacity';
    const SHOWROOM_CAPACITY_KEY = 'showroomCapacity';
    function readServiceCap() {
        try { return Number(localStorage.getItem(SERVICE_CAPACITY_KEY)) || 5; } catch { return 5; }
    }
    function readShowroomCap() {
        try { return Number(localStorage.getItem(SHOWROOM_CAPACITY_KEY)) || 5; } catch { return 5; }
    }

    const [serviceCap, setServiceCap] = useState(readServiceCap());
    const [showroomCap, setShowroomCap] = useState(readShowroomCap());

    const [spec, setSpec] = useState(readSpecCurrent());
    const [specChange, setSpecChange] = useState(readSpecChange());

    useEffect(() => {
        function getLiveShowroom() {
            const raw = localStorage.getItem(SHOWROOM_KEY);
            const list = raw ? JSON.parse(raw) : [];
            const now = Date.now();

            // разделяем на проданные и ещё продающиеся
            const sold = list.filter(s => (s.endAt || 0) <= now);
            const filtered = list.filter(s => (s.endAt || 0) > now);

            // если что-то продано — зачисляем деньги один раз перед очисткой
            if (sold.length) {
                const total = sold.reduce((acc, s) => acc + (s.price || 0), 0);
                if (total > 0) {
                    add(total);
                }
            }

            // сохраняем очищенный список
            if (filtered.length !== list.length) {
                localStorage.setItem(SHOWROOM_KEY, JSON.stringify(filtered));
            }
            return filtered;
        }

        function refresh() {
            const capService = readServiceCap();
            const capShowroom = readShowroomCap();
            setServiceCap(capService);
            setShowroomCap(capShowroom);

            const stored = localStorage.getItem('purchasedCars');
            const cars = stored ? JSON.parse(stored) : [];
            const waiting = cars.filter(c => c.status === 'waiting').length;
            const inProgress = cars.filter(c => c.status === 'inProgress').length;
            const total = cars.length;

            setWaitingCount(waiting);
            setInProgressCount(inProgress);
            setUsedPercent(Math.min(100, Math.round((total / capService) * 100)));

            const showroom = getLiveShowroom();
            setShowroomCount(showroom.length);
            setShowroomSum(showroom.reduce((s, it) => s + (it.price || 0), 0));

            setSpec(readSpecCurrent());
            setSpecChange(readSpecChange());
        }

        refresh();
        const id = setInterval(refresh, 1000); // обновляем счётчики раз в секунду

        // если localStorage меняется из другой вкладки — тоже обновим
        const onStorage = (e) => {
            if (e.key === 'showroomCars' || e.key === 'purchasedCars' || e.key === 'serviceCapacity' || e.key === 'showroomCapacity') {
                refresh();
            }
        };
        window.addEventListener('storage', onStorage);

        return () => {
            clearInterval(id);
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    useEffect(() => {
        function tickSpec() {
            const pending = readSpecChange();
            if (pending && Date.now() >= pending.endAt) {
                writeSpecCurrent(pending.target);
                clearSpecChange();
                setSpec(pending.target);
                setSpecChange(null);
                try { window.dispatchEvent(new Event('spec:changed')); } catch {}
            } else {
                // чтобы главная всегда видела актуальные значения (если поменяли в другой вкладке)
                setSpec(readSpecCurrent());
                setSpecChange(pending);
            }
        }

        // первый запуск и интервал
        tickSpec();
        const t = setInterval(tickSpec, 1000);

        // обновлять при возвращении во вкладку и при cross-tab изменениях
        const onFocus = () => tickSpec();
        const onStorage = (e) => {
            if (e.key === SPEC_CURRENT_KEY || e.key === SPEC_CHANGE_KEY) tickSpec();
        };

        window.addEventListener('focus', onFocus);
        window.addEventListener('storage', onStorage);

        return () => {
            clearInterval(t);
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    return (
        <div className="main-screen">
            {/* Header */}
            <div className="header">
                <div className="header-center">
                    <MdCarRepair className="icon-header" />
                    <span className="header-title">Автосалон</span>
                </div>

                <button className="settings-btn"><IoMdSettings /></button>
            </div>

            <button className="play-button-top-left" onClick={() => navigate('/arcade')}>
                <FaPlay className='icon-play' /> Играть
            </button>

            {/* Balance */}
            <div className="balance-box-wrapper">
                <div className="balance-box">
                    <h1>$ {formatMoney(balance)}</h1>
                    <div className='text-balance-box'>Баланс</div>
                </div>
            </div>

            {/* Автосервис */}
            <button className="section service-box" onClick={() => navigate('/service')}>
                <div className="section-header">Автосервис</div>

                <div className="service-body">
                    <div className="circle-wrapper" style={{ '--percent': `${usedPercent}%` }}>
                        <div className="circle-progress-ring"></div>
                        <div className="circle">
                            <strong>{usedPercent}%</strong>
                            <span style={{ fontSize: '12px', color: '#aaa' }}>Использовано</span>
                        </div>
                    </div>

                    <div className="service-info">
                        <div className="info-row">
                            <span className="info-icon"><FaRegClock /></span>
                            <div className="info-text">
                                <div className='text'>В ожидании</div>
                                <div className="info-value">{waitingCount}</div>
                            </div>
                        </div>

                        <div className="info-row">
                            <span className="info-icon"><FaWrench /></span>
                            <div className="info-text">
                                <div className='text'>В работе</div>
                                <div className="info-value">{inProgressCount}</div>
                            </div>
                        </div>

                        <div className="info-row">
                            <span className="info-icon"><PiGarageBold /></span>
                            <div className="info-text">
                                <div className='text'>Вместимость</div>
                                <div className="info-value">{serviceCap}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </button>

            {/* Выставочный зал */}
            <button className="section showroom-box" onClick={() => navigate('/showroom')}>
                <h3 className="showroom-title">Выставочный зал</h3>

                <div className="showroom-top">
                    <div className="info-box left-box">
                        <p className="info-value">{showroomCount}</p>
                        <span className="info-label">Авто на продаже</span>
                    </div>
                    <div className="info-box right-box">
                        <p className="info-value">{showroomCap}</p>
                        <span className="info-label">Вместимость зала</span>
                    </div>
                </div>

                <div className="showroom-bottom">
                    <div className="price-box">
                        <span className="price-icon"><FaCoins /></span>
                        <div className="price-text">
                            <p className="info-value">$ {showroomSum.toLocaleString('ru-RU')}</p>
                            <span className="info-label">Общая стоимость автомобилей</span>
                        </div>
                    </div>
                </div>
            </button>

            {/* Кнопки */}
            <div className="button-grid">
                {/* Верхний блок — рынок */}
                <div className="button-row">
                    <button className="button half-button" onClick={() => navigate('/market')}>
                        <div className="icon-text-wrapper">
                            <FaCar className="icon-car" />
                            <div className="text-car">Рынок автомобилей</div>
                        </div>
                    </button>
                </div>


                {/* Заголовок */}
                <h3 className="upgrade-title">Улучшения и инвестиции</h3>

                {/* Нижние 4 кнопки */}
                <div className="button-grid-3">
                    <button className="button third-button" onClick={() => navigate('/upgrade/service')}>
                        <FaScrewdriverWrench className='icons-grid-3' />
                        <span>Автосервис</span>
                    </button>

                    <button className="button third-button" onClick={() => navigate('/upgrade/showroom')}>
                        <PiGarage className='icons-grid-3' />
                        <span>Выставочный зал</span>
                    </button>
                </div>

                <div className="button-grid-3">
                    <button className="button third-button">
                        <GiSkills className='icons-grid-3' />
                        <span>Навыки</span>
                    </button>

                    <button className="button third-button specialization-button" onClick={() => navigate('/specialization')}>
                        <span className="spec-title">Специализация</span>
                        <div className="bar">
                            <div
                                className="fill"
                                style={{
                                    width: spec === 'mass' ? '33%' : spec === 'lux' ? '66%' : '100%'
                                }}
                            ></div>
                        </div>
                        <p className="spec-subtitle">
                            {spec === 'mass' ? 'Автомобили массового использования' :
                            spec === 'lux' ? 'Роскошные и спортивные автомобили' :
                            'Автомобили премиум сегмента'}
                        </p>
                        <p className="spec-hint">{specChange ? 'Смена в процессе…' : 'Нажмите, чтобы сменить'}</p>
                    </button>
                </div>
            </div>

        </div>
    );
}

export default MainScreen;