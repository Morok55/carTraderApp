import React from 'react';
import carsData from '../data/carsData';

export default function CarInfo({ car, parts }) {
    // ищем базовую модель по car.carId и считаем «0–100»
    const base = carsData.find(m => m.id === car.carId);
    const baseCoef = Number(base?.arcadeAccel ?? 1);

    // среднее состояние по узлам (0..100)
    const cond = car?.condition || {};
    const keys = ['engine', 'transmission', 'suspension', 'body', 'electrics', 'interior'];
    const avg = keys.reduce((s, k) => s + (Number(cond[k]) || 0), 0) / keys.length || 0;

    // как в аркаде: здоровье 0.4..1.0, чтобы совсем «трупы» не превращались в улитку
    const health = Math.max(0.4, Math.min(1, avg / 100));

    // эффективный коэффициент для аркады
    const effCoef = baseCoef * (0.5 + 0.5 * health);

    // время 0–100 (та же формула и клампы, что ты используешь)
    const t00100 = Math.max(3.2, Math.min(20.0, 8.0 / effCoef));

    return (
        <div>
            {/* верхняя карточка */}
            <div className="car-top-box">
                <img src={car.image} alt={car.name} className="details-image" />
                <div className="top-info">
                    <h2>{car.name}</h2>
                    <div className="car-price">
                        $ {car.price.toLocaleString('ru-RU')}
                    </div>
                    <div className="car-accel">
                        Разгон 0–100 км/ч: {t00100.toFixed(1)} сек.
                    </div>
                </div>
            </div>

            {/* состояние узлов */}
            <div className="car-status-grid">
                {parts.map(part => {
                    const value = car.condition[part.key];
                    const color =
                        value > 80 ? '#00C853' :
                        value > 55 ? '#FFD600' :
                        value > 30 ? '#FF6D00' : '#D50000';
                    return (
                        <div className="car-status-row" key={part.key}>
                        <div className="part-label">
                            <span className="part-icon">{part.icon}</span>
                            <span>{part.label}</span>
                        </div>
                        <div className="part-bar">
                            <div
                            className="part-fill"
                            style={{ width: `${value}%`, backgroundColor: color }}
                            />
                        </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
