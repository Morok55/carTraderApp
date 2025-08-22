import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import '../css/carDetails.css';
import carsData from '../data/carsData';
import CarInfo from '../components/CarInfo';
import { useBalance } from '../balance';

import { TbEngine } from "react-icons/tb";
import { MdOutlineSettings } from "react-icons/md";
import { GiCartwheel } from "react-icons/gi";
import { MdElectricBolt } from "react-icons/md";
import { FaCarSide } from "react-icons/fa";
import { PiSeatBold } from "react-icons/pi";

const MARKET_STORAGE_KEY = 'marketCarsWithTime';
const PURCHASED_KEY      = 'purchasedCars';
const SERVICE_CAPACITY_KEY = 'serviceCapacity';

function readServiceCap() {
    try { return Number(localStorage.getItem(SERVICE_CAPACITY_KEY)) || 5; } catch { return 5; }
}
function countServiceCars() {
    try {
        const stored = localStorage.getItem(PURCHASED_KEY);
        const arr = stored ? JSON.parse(stored) : [];
        return arr.length;
    } catch {
        return 0;
    }
}
function notifyCapacity(title, message) {
    const wa = window.Telegram && window.Telegram.WebApp;
    const canPopup = !!(wa && typeof wa.showPopup === 'function' && typeof wa.isVersionAtLeast === 'function' && wa.isVersionAtLeast('6.2'));
    if (canPopup) {
        try { wa.showPopup({ title, message }); return; } catch (e) {}
    }
    alert(message);
}

function CarDetails() {
    const { state: car } = useLocation();
    const navigate = useNavigate();
    const { spend } = useBalance();

    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        tg?.BackButton?.show();
        tg?.BackButton?.onClick(() => {
            navigate('/market', { replace: true });
        });

        return () => {
            tg?.BackButton?.offClick?.();
            tg?.BackButton?.hide?.();
        };
    }, [navigate]);

    const parts = [
        { key: 'engine', label: 'Двигатель', icon: <TbEngine /> },
        { key: 'transmission', label: 'Трансмиссия', icon: <MdOutlineSettings /> },
        { key: 'suspension', label: 'Ходовая часть', icon: <GiCartwheel /> },
        { key: 'body', label: 'Кузов и ЛКП', icon: <FaCarSide /> },
        { key: 'electrics', label: 'Электрика', icon: <MdElectricBolt /> },
        { key: 'interior', label: 'Салон', icon: <PiSeatBold /> },
    ];

    const handleBuy = () => {
        const cap = readServiceCap();
        const used = countServiceCars();
        if (used >= cap) {
            notifyCapacity('Нет свободных мест', `Автосервис заполнен (${used}/${cap}). Освободите место или увеличьте вместимость.`);
            return;
        }
        
        // Денег хватает?
        if (!spend(car.price)) return;

        // 1. Удаляем машину из рынка
        const marketDataRaw = localStorage.getItem(MARKET_STORAGE_KEY);
        if (marketDataRaw) {
            const parsed = JSON.parse(marketDataRaw);
            const filtered = (parsed.cars || []).filter(c => c.id !== car.id);
            localStorage.setItem(
                MARKET_STORAGE_KEY,
                JSON.stringify({
                    timestamp: parsed.timestamp,
                    cars: filtered
                })
            );
        }

        // 2. Добавляем машину в список купленных, со статусом "waiting"
        const storedPurchased = localStorage.getItem(PURCHASED_KEY);
        const purchased = storedPurchased ? JSON.parse(storedPurchased) : [];

        const modelBase = car.basePrice
            ?? (carsData.find(m => m.id === car.carId)?.basePrice)
            ?? car.price; // крайний фолбэк

        // точное состояние (без шума)
        const trueCondition = car.condition || car.conditionTrue || car.displayCondition;

        purchased.push({
            ...car,
            status: 'waiting',
            condition: trueCondition,  // перезаписываем на точное
            purchasePrice: car.price,  // честная цена покупки
            basePrice: modelBase,
            repairInvested: 0
        });

        localStorage.setItem(PURCHASED_KEY, JSON.stringify(purchased));

        // 3. Переходим в маркет, заменяя текущий шаг в истории
        navigate('/market', { replace: true });
    };

    return (
        <div className="car-details">
            {/* верхняя карточка */}
            <CarInfo
                car={{ ...car, price: car.marketPrice, condition: car.displayCondition || car.condition }}
                parts={parts}
            />

            <button className="buy-button" onClick={handleBuy}>
                Купить
            </button>
        </div>
    );
}

export default CarDetails;
