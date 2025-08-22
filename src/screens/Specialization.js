// screens/Specialization.js
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/specialization.css';
import { carsMass, carsLuxSport, carsPremium } from '../data/carsData';
import { GrMoney } from "react-icons/gr";

const SPEC_CURRENT_KEY = 'specCurrent';     // 'mass' | 'lux' | 'premium'
const SPEC_CHANGE_KEY  = 'specChange';      // { target, endAt, startedAt }

function readCurrent() {
    try { return localStorage.getItem(SPEC_CURRENT_KEY) || 'mass'; } catch { return 'mass'; }
}
function writeCurrent(v) {
    try { localStorage.setItem(SPEC_CURRENT_KEY, v); } catch {}
}
function readChange() {
    try { return JSON.parse(localStorage.getItem(SPEC_CHANGE_KEY) || 'null'); } catch { return null; }
}
function writeChange(v) {
    try {
        if (v) localStorage.setItem(SPEC_CHANGE_KEY, JSON.stringify(v));
        else localStorage.removeItem(SPEC_CHANGE_KEY);
    } catch {}
}

function avgPrice(list) {
    if (!list.length) return 0;
    const sum = list.reduce((s, c) => s + (c.basePrice || 0), 0);
    return Math.round(sum / list.length);
}

function sampleNames(list, n = 4) {
    return list.slice(0, n).map(m => `${m.brand} ${m.model}`).join(', ') + (list.length > n ? ' и др.' : '');
}

export default function Specialization() {
    const navigate = useNavigate();

    const [current, setCurrent] = useState(readCurrent());
    const [pending, setPending] = useState(readChange());
    const [now, setNow] = useState(Date.now());

    const [selected, setSelected] = useState(readCurrent()); // что подсвечено пользователем

    const segments = useMemo(() => ([
        {
            key: 'mass',
            title: 'Автомобили массового использования',
            list: carsMass
        },
        {
            key: 'lux',
            title: 'Роскошные и спортивные автомобили',
            list: carsLuxSport
        },
        {
            key: 'premium',
            title: 'Автомобили премиум сегмента',
            list: carsPremium
        }
    ]), []);

    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        tg?.BackButton?.show();
        tg?.BackButton?.onClick(() => navigate('/', { replace: true }));
        return () => {
            tg?.BackButton?.offClick?.();
            tg?.BackButton?.hide?.();
        };
    }, [navigate]);

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    // Если таймер закончился — применяем специализацию
    useEffect(() => {
        if (pending && pending.endAt <= now) {
            setCurrent(pending.target);
            writeCurrent(pending.target);
            setPending(null);
            writeChange(null);
            try { window.dispatchEvent(new Event('spec:changed')); } catch {}
        }
    }, [now, pending]);

    function startChange(target) {
        if (target === current) return;
        if (pending) return; // пока идёт смена — не стартуем новую
        // const endAt = Date.now() + 60 * 60 * 1000; // 1 час
        const endAt = Date.now() + 10 * 1000;
        const rec = { target, endAt, startedAt: Date.now() };
        setPending(rec);
        writeChange(rec);
    }

    const remainMs = pending ? Math.max(0, pending.endAt - now) : 0;
    const remainS  = Math.ceil(remainMs / 1000);
    const h = Math.floor(remainS / 3600);
    const m = Math.floor((remainS % 3600) / 60);
    const s = remainS % 60;
    const remainStr = `${h} ч. ${m} мин. ${s < 10 ? '0' + s : s} сек.`;
    const progress = pending ? Math.min(100, Math.round(((now - pending.startedAt) / (pending.endAt - pending.startedAt)) * 100)) : 0;

    return (
        <div className="spec-screen">
            <div className="spec-header">
                <div className="spec-title">Специализация</div>
            </div>

            {pending ? (
                <div className="spec-card">
                    <div className="sc-header">
                        <div className="sc-header-title">{segments.find(s => s.key === pending.target)?.title}</div>
                    </div>
                    <div className="sc-body">
                        {/* список авто */}
                        <div className="spc-subcars">
                            {sampleNames(segments.find(s => s.key === pending.target)?.list || [])}
                        </div>

                        {/* средняя цена */}
                        <div className="sc-price-row">
                            <GrMoney className="sc-money-icon" />
                            <div>
                                <div className="sc-price">
                                    ${avgPrice(segments.find(s => s.key === pending.target)?.list || []).toLocaleString('ru-RU')}
                                </div>
                                <div className="sc-price-label">Средняя цена авто в сегменте</div>
                            </div>
                        </div>

                        {/* прогресс бар */}
                        <div className="spc-progressbar">
                            <div className="spc-progressfill" style={{ width: `${progress}%` }}></div>
                        </div>

                        {/* время */}
                        <div className="spc-time">{remainStr}</div>
                        <div className="spc-sub">Оставшееся время</div>
                    </div>
                </div>
            ) : (
                <>
                    <div className="spec-list">
                        {segments.map(seg => {
                            const avg = avgPrice(seg.list);
                            const descr = sampleNames(seg.list);
                            const isCurrent = seg.key === current;
                            const isSelected = seg.key === selected;
                            return (
                                <button
                                    key={seg.key}
                                    className={[
                                        'spec-card',
                                        isCurrent ? 'is-current' : '',
                                        isSelected ? 'is-selected' : ''
                                    ].join(' ').trim()}
                                    onClick={() => {
                                        if (seg.key === 'premium') return; // 🚫 запрет на премиум
                                        setSelected(seg.key);
                                    }}
                                >
                                    <div className="sc-header">
                                        <div className="sc-header-title">{seg.title}</div>
                                    </div>
                                    <div className="sc-body">
                                        <div className="sc-descr">{descr}</div>
                                        <div className="sc-price-row">
                                            <GrMoney className="money-ico" />
                                            <div className="sc-price-box">
                                                <div className="sc-price">$ {avg.toLocaleString('ru-RU')}</div>
                                                <div className="sc-hint">Средняя цена авто в сегменте</div>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    
                    <div className="spec-actions">
                        <button
                            className="spec-apply"
                            onClick={() => startChange(selected)}
                            disabled={!selected || selected === current}
                        >
                            Сменить специализацию
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
