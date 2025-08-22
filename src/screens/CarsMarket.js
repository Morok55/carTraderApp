import React, { useEffect, useState } from 'react';
import carsData from '../data/carsData';
import { generateMarketCars } from '../data/marketCars';
import { useNavigate } from 'react-router-dom';
import '../css/marketCars.css';
import { useBalance, formatMoney } from '../balance';
import { FaSearch } from "react-icons/fa";

const SPEC_KEY = 'specCurrent';
function readSpec() {
    try { return localStorage.getItem(SPEC_KEY) || 'mass'; } catch { return 'mass'; }
}

function UsedCarsMarket() {
    const { balance } = useBalance();
    const [spec, setSpec] = useState(() => readSpec());
    const [marketCars, setMarketCars] = useState(() => generateMarketCars());
    const [query, setQuery] = useState('');
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');
    const navigate = useNavigate();

    const [sortMode, setSortMode] = useState(null); // null | 'asc' | 'desc'

    function toggleSort() {
        setSortMode(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc');
    }

    useEffect(() => {
        // Прокрутка в начало при открытии страницы
        // window.scrollTo(0, 0)

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

    useEffect(() => {
        const onFocus = () => setSpec(readSpec());
        const onStorage = (e) => { if (e.key === SPEC_KEY) setSpec(readSpec()); };
        const onSpecEvent = () => setSpec(readSpec());

        window.addEventListener('focus', onFocus);
        window.addEventListener('storage', onStorage);
        window.addEventListener('spec:changed', onSpecEvent);

        return () => {
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('spec:changed', onSpecEvent);
        };
    }, []);

    useEffect(() => {
        setMarketCars(generateMarketCars());
    }, [spec]);

    function parseNum(v) {
        const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
        return isNaN(n) ? null : n;
    }

    const minParsed = parseNum(minPrice);
    const maxParsed = parseNum(maxPrice);
    let lo = minParsed == null ? -Infinity : minParsed;
    let hi = maxParsed == null ?  Infinity : maxParsed;
    if (minParsed != null && maxParsed != null && minParsed > maxParsed) {
        const t = lo;
        lo = hi;
        hi = t;
    }

    const filteredCars = marketCars.filter(car => {
        const m = carsData.find(c => c.id === car.carId);
        const name = `${m?.brand || ''} ${m?.model || ''}`.toLowerCase();
        const nameOk = name.includes(query.trim().toLowerCase());
        const priceOk = car.marketPrice >= lo && car.marketPrice <= hi;
        return nameOk && priceOk;
    });

    const sortedCars = (() => {
        if (sortMode === 'asc') {
            return [...filteredCars].sort((a, b) => (a.marketPrice || 0) - (b.marketPrice || 0));
        }
        if (sortMode === 'desc') {
            return [...filteredCars].sort((a, b) => (b.marketPrice || 0) - (a.marketPrice || 0));
        }
        return filteredCars; // исходный порядок
    })();

    return (
        <div className="used-cars-market">
            <div className="market-header">
                <div className="market-head-left">
                    <h2 className="market-title">Авторынок</h2>
                    <div className="market-balance">
                        Баланс: <span>$ {formatMoney(balance)}</span>
                    </div>
                </div>

                <button className="sort-button" onClick={toggleSort}>
                    {sortMode === null && 'Сортировать по цене '}
                    {sortMode === 'asc' && 'Сортировать по цене ↑'}
                    {sortMode === 'desc' && 'Сортировать по цене ↓'}
                </button>
            </div>

            <div className="market-price">
                <span className="price-label">Цена от</span>
                <input
                    type="number"
                    inputMode="numeric"
                    placeholder=""
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    aria-label="Минимальная цена"
                />
                <span className="price-label">до</span>
                <input
                    type="number"
                    inputMode="numeric"
                    placeholder=""
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    aria-label="Максимальная цена"
                />
            </div>

            <div className="market-search">
                <FaSearch className="search-icon" />
                <input
                    type="text"
                    placeholder="Поиск по названию (марка, модель)"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Поиск по автомобилям"
                />
            </div>

            <div className="cars-list">
                {sortedCars.map(car => {
                    const model = carsData.find(c => c.id === car.carId);
                    const cond = car.displayCondition || car.condition;
                    const avgCondition = Object.values(cond).reduce((a, b) => a + b, 0) / 6;
                    return (
                        <div className="car-card" key={car.id} onClick={() => navigate(`/market/${car.id}`, { state: car })}>
                            <img src={model.image} alt={model.model} className="car-image" width="90" loading="eager" />
                            <div className="car-info">
                                <div className="car-name">{model.brand} {model.model}</div>
                                <div className="car-condition">
                                    Состояние:
                                    <div className="condition-bar">
                                        <div
                                            className="condition-fill"
                                            style={{
                                                width: `${avgCondition}%`,
                                                backgroundColor: avgCondition > 80 ? '#00C853' :
                                                                avgCondition > 55 ? '#FFD600' :
                                                                avgCondition > 30 ? '#FF6D00' : '#D50000'
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="car-price">
                                    $ {car.marketPrice.toLocaleString('ru-RU')}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {sortedCars.length === 0 && (
                    <div className="empty-result">Ничего не найдено</div>
                )}
            </div>
        </div>
    );
}

export default UsedCarsMarket;
