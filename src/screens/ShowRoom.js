import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/serviceCenter.css';
import carsData from '../data/carsData';
import { useBalance } from '../balance';

const SHOWROOM_KEY = 'showroomCars';

function loadShowroom() {
    try { return JSON.parse(localStorage.getItem(SHOWROOM_KEY) || '[]'); }
    catch { return []; }
}
function saveShowroom(arr) {
    localStorage.setItem(SHOWROOM_KEY, JSON.stringify(arr));
}

function fmtDur(mins) {
    const m = Math.max(0, Math.round(mins));
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (h <= 0) return `${mm} мин`;
    if (mm === 0) return `${h} ч`;
    return `${h} ч ${mm} мин`;
}

export default function Showroom() {
    const { add } = useBalance();
    const navigate = useNavigate();
    const [items, setItems] = useState(() => loadShowroom());
    const [now, setNow] = useState(Date.now());
    const [selected, setSelected] = useState(null);

    // анимация закрытия модалки
    const [modalClosing, setModalClosing] = useState(false);
    const MODAL_MS = 200;

    function openInfo(item) {
        setModalClosing(false);
        setSelected(item);
    }
    function closeInfo() {
        setModalClosing(true);
        setTimeout(() => {
            setSelected(null);
            setModalClosing(false);
        }, MODAL_MS);
    }

    // Telegram BackButton → назад на Главный
    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        tg?.BackButton?.show();
        tg?.BackButton?.onClick(() => navigate('/', { replace: true }));
        return () => {
            tg?.BackButton?.offClick?.();
            tg?.BackButton?.hide?.();
        };
    }, [navigate]);

    // тик раз в секунду
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    // авто-очистка завершённых продаж
    useEffect(() => {
        const all = loadShowroom();
        const sold = all.filter(s => (s.endAt || 0) <= now);
        const filtered = all.filter(s => (s.endAt || 0) > now);
        if (sold.length) {
            const total = sold.reduce((acc, s) => acc + (s.price || 0), 0);
            if (total > 0) {
                add(total);
            }
        }
        if (filtered.length !== items.length) {
            setItems(filtered);
            saveShowroom(filtered);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [now]);

    const totalValue = useMemo(
        () => items.reduce((sum, s) => sum + (s.price || 0), 0),
        [items]
    );

    const selectedNet = selected
        ? (selected.price || 0) - (selected.purchasePaid || 0) - (selected.invested || 0)
        : 0;

    return (
        <div className="service-center">
            <h2 className="service-title">Выставочный зал</h2>

            <div style={{ opacity: 0.9 }}>
                Авто на продаже: <b>{items.length}</b>
                <div style={{ marginTop: '5px' }}>
                    Общая сумма: <b>$ {totalValue.toLocaleString('ru-RU')}</b>
                </div>
            </div>

            <div className="service-grid">
                {items.length === 0 && (
                    <div style={{ opacity: 0.7, width: '100%', textAlign: 'center', padding: '24px 0' }}>
                        Пока нет автомобилей на продаже
                    </div>
                )}
                {items.map(item => {
                    const model = carsData.find(m => m.id === item.carId);
                    const name = item.name || (model ? `${model.brand} ${model.model}` : 'Авто');
                    const img = item.image || model?.image;
                    const remainMs = (item.endAt || 0) - now;
                    const remainMins = Math.ceil(Math.max(0, remainMs) / 60000);

                    return (
                        <button className="service-card" key={item.id} onClick={() => openInfo(item)}>
                            <div className="service-thumb">
                                <img
                                    src={img}
                                    alt={name}
                                    className="service-image"
                                    loading="eager"
                                    decoding="async"
                                />
                            </div>
                            <div className="service-name">{name}</div>
                            <div className="service-info">
                                <div className="service-label">Осталось</div>
                                <div className="service-price">{fmtDur(remainMins)}</div>

                                <div className="service-label" style={{ marginTop: 8 }}>Цена</div>
                                <div className="service-price">$ {item.price?.toLocaleString('ru-RU')}</div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Модалка без порталов: открытие/закрытие с анимацией */}
            {selected && (
                <div className={`modal-backdrop ${modalClosing ? 'fade-out' : 'fade-in'}`} onClick={closeInfo}
                >
                    <div className={`modal-card ${modalClosing ? 'pop-out' : 'pop-in'}`} onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-title">Продажа {selected.name}</div>
                        <div className="sell-meta">
                            <div className="sell-meta__row">
                                <span>Цена:</span>
                                <span className="sell-meta__num">
                                    $ {selected.price?.toLocaleString('ru-RU')}
                                </span>
                            </div>
                            <div className="sell-meta__row">
                                <span>Чистый доход:</span>
                                <span className={`sell-meta__num ${selectedNet >= 0 ? 'pos' : 'neg'}`}>
                                    $ {selectedNet.toLocaleString('ru-RU')}
                                </span>
                            </div>
                            <div className="sell-meta__row">
                                <span>Осталось времени:</span>
                                <span className="sell-meta__num">
                                    {fmtDur(Math.ceil(((selected.endAt || 0) - now) / 60000))}
                                </span>
                            </div>
                        </div>
                        <div className="modal-actions" style={{ marginTop: 12 }}>
                            <button className="btn btn-primary" onClick={closeInfo}>Ок</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
