import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/serviceCenter.css';
import carsData from '../data/carsData';

import { LuWrench } from "react-icons/lu";

function getBase(car) {
    return (
        car?.basePrice ??
        (carsData.find(m => m.id === car?.carId)?.basePrice) ??
        car?.purchasePrice ??
        car?.price ?? 0
    );
}

function estimateMarketValue(car) {
    const avg = Object.values(car.condition || {}).reduce((a, b) => a + b, 0) / 6;
    const base = getBase(car);
    return Math.round(base * (avg / 100));
}

function ServiceCenter() {
    const navigate = useNavigate();
    const [serviceCars, setServiceCars] = useState(() => {
        const stored = localStorage.getItem('purchasedCars');
        return stored ? JSON.parse(stored) : [];
    });
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        tg?.BackButton?.show();
        tg?.BackButton?.onClick(() => {
            navigate('/', { replace: true });
        });

        return () => {
            tg?.BackButton?.offClick?.();
            tg?.BackButton?.hide?.();
        };
    }, [navigate]);

    // тикаем раз в секунду
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    // авто-завершение ремонтов и обновление списка
    useEffect(() => {
        const stored = localStorage.getItem('purchasedCars');
        const list = stored ? JSON.parse(stored) : [];
        let changed = false;

        const updated = list.map((c) => {
            const active = c?.activeRepair;
            if (active && active.endAt <= now) {
                const updatedCar = {
                    ...c,
                    condition: { ...(c.condition || {}) },
                    status: 'waiting'
                };
                const invested = updatedCar.repairInvested || 0;
                const planned = Math.max(0, Math.round(active.cost || 0));
                (active.parts || []).forEach((k) => {
                    updatedCar.condition[k] = 100;
                });
                updatedCar.repairInvested = invested + planned;
                if (typeof updatedCar.purchasePrice !== 'number') {
                    updatedCar.purchasePrice = updatedCar.price;
                }
                delete updatedCar.activeRepair;
                changed = true;
                return updatedCar;
            }
            return c;
        });

        if (changed) {
            localStorage.setItem('purchasedCars', JSON.stringify(updated));
        }
        setServiceCars(updated);
    }, [now]);

    return (
        <div className="service-center">
            <h2 className="service-title">Автосервис</h2>
            <div className="service-grid">
                {serviceCars.map(car => {
                    const marketValue = estimateMarketValue(car);
                    return (
                        <div className="service-card" key={car.id} onClick={() => navigate(`/service/${car.id}`, { state: car })}>
                            <div className="service-thumb">
                                <img
                                    src={car.image}
                                    alt={car.name}
                                    className="service-image"
                                    loading="eager"
                                    decoding="async"
                                />
                                {(car.activeRepair && (car.activeRepair.endAt > now)) && (
                                    <div className="repairing-icon"><LuWrench /></div>
                                )}
                            </div>
                            <div className="service-name">{car.name}</div>
                            <div className="service-info">
                                <div className="service-price">
                                    $ {marketValue.toLocaleString('ru-RU')}
                                </div>
                                <div className="service-label">Cтоимость</div>
                            </div>
                        </div>
                    );
                })}
                {serviceCars.length === 0 && (
                    <p style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>
                        Нет машин для ремонта
                    </p>
                )}
            </div>
        </div>
    );
}

export default ServiceCenter;
