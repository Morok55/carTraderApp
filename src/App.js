import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route, useLocation, useNavigationType } from 'react-router-dom';
import './css/main.css';
import carsData from './data/carsData';
import { BalanceProvider } from './balance';
import PreloadAssets from './components/PreloadAssets';

import MainScreen from './screens/MainScreen';
import UsedCarsMarket from './screens/CarsMarket';
import CarDetails from './screens/CarDetails';
import ServiceCenter from './screens/ServiceCenter';
import Arcade from './screens/Arcade';
import ServiceCarDetails from './screens/ServiceCarDetails';
import Showroom from './screens/ShowRoom';
import UpgradeServiceCapacity from './screens/UpgradeServiceCapacity';
import UpgradeShowroomCapacity from './screens/UpgradeShowroomCapacity';
import Specialization from './screens/Specialization';

const ANIM_MS = 150; // синхронизировано с CSS

export default function App() {
    const location = useLocation();
    const navType = useNavigationType(); // 'PUSH' | 'POP' | 'REPLACE'

    // нижний (статичный во время анимации) и верхний (анимируемый) location
    const [displayLocation, setDisplayLocation] = useState(location);
    const [transitionLocation, setTransitionLocation] = useState(null);
    const firstMount = useRef(true);
    const [underAnimClass, setUnderAnimClass] = useState('');
    const [lockHeight, setLockHeight] = useState(null);
    const stackRef = useRef(null);
    const underRef = useRef(null);
    const overRef  = useRef(null);

    // направление: PUSH — вперёд (справа→налево), POP/REPLACE — назад
    const animClass =
        firstMount.current ? 'no-anim'
        : navType === 'PUSH' ? 'enter-from-right'
        : 'enter-from-left';

    // при первом маунте — без анимации
    useEffect(() => {
        firstMount.current = false;
    }, []);

    // запускаем переход: верхний слой рендерит новый экран, нижний остаётся прежним
    useEffect(() => {
        if (location.key === displayLocation.key) return;

        const back = navType !== 'PUSH';
        setUnderAnimClass(back ? 'leave-to-right' : 'leave-to-left');

        setTransitionLocation(location);

        // после появления верхнего слоя — ставим его в самый верх
        requestAnimationFrame(() => {
            if (overRef.current) overRef.current.scrollTop = 0;

            const oldH = underRef.current?.scrollHeight || 0;
            const newH = overRef.current?.scrollHeight  || 0;
            setLockHeight(Math.max(oldH, newH));
        });

        const t = setTimeout(() => {
            setDisplayLocation(location);
            setTransitionLocation(null);
            setUnderAnimClass('');
            setLockHeight(null);

            // и нижний слой сразу наверх, чтобы после подмены не было «подскролла»
            requestAnimationFrame(() => {
                if (underRef.current) underRef.current.scrollTop = 0;
            });
        }, ANIM_MS);

        return () => clearTimeout(t);
    }, [location, displayLocation, navType]);

    // тихий предпрогрев изображений моделей — сразу при старте приложения
    useEffect(() => {
        if (navigator.connection && navigator.connection.saveData) return;

        const urls = Array.from(new Set(
            (carsData || [])
                .flatMap(m => [m.image, m.imageArcade])
                .filter(Boolean)
        ));

        let aborted = false;
        const inflight = new Set();
        const MAX_PARALLEL = 4;

        const loadNext = () => {
            if (aborted) return;
            while (inflight.size < MAX_PARALLEL && urls.length) {
                const url = urls.shift();
                const img = new Image();
                inflight.add(img);
                img.decoding = 'async';
                img.loading = 'eager';
                img.onload = img.onerror = () => {
                    inflight.delete(img);
                    loadNext();
                };
                img.src = url;
            }
        };

        const t = setTimeout(loadNext, 50);

        return () => {
            aborted = true;
            clearTimeout(t);
            inflight.forEach(i => { i.onload = i.onerror = null; });
            inflight.clear();
        };
    }, []);

    // ПЕРВЫЙ ЗАПУСК: один раз дарим Lada Samara с минимальной поломкой → максимум прибыли после ремонта
    useEffect(() => {
        const FLAG = 'firstRunGiftSamara_1000_2000';
        try {
            if (localStorage.getItem(FLAG)) return;

            const model = (carsData || []).find(m => m.id === 26);
            if (!model) {
                localStorage.setItem(FLAG, '1');
                return;
            }

            const listRaw = localStorage.getItem('purchasedCars');
            const list = listRaw ? JSON.parse(listRaw) : [];

            const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : String(Date.now()) + '_' + Math.random().toString(36).slice(2);

            // всем узлам даём 78% (среднее состояние)
            // → полный ремонт всех частей ≈ $2000 для Samara (basePrice 4200)
            const condition = {
                engine: 78,
                transmission: 78,
                suspension: 78,
                body: 78,
                electrics: 78,
                interior: 78
            };

            const gifted = {
                id,
                carId: model.id,
                name: `${model.brand} ${model.model}`,
                image: model.image,
                status: 'waiting',
                condition,
                basePrice: model.basePrice,
                // «дали за $1000»
                price: 1000,           // для отображений, где используется price
                purchasePrice: 1000,   // честно уплаченная цена
                repairInvested: 0
            };

            list.push(gifted);
            localStorage.setItem('purchasedCars', JSON.stringify(list));
            localStorage.setItem(FLAG, '1');
        } catch {
            try { localStorage.setItem('firstRunGiftSamara_1000_2000', '1'); } catch {}
        }
    }, []);

    useEffect(() => {
        try {
            if (!localStorage.getItem('specCurrent')) {
                localStorage.setItem('specCurrent', 'mass');
            }
        } catch {}
    }, []);

    // мемо нижнего Routes — чтобы во время анимации он вообще не перерисовывался
    const underRoutes = useMemo(() => (
        <Routes location={displayLocation}>
            <Route path="/" element={<MainScreen />} />
            <Route path="/market" element={<UsedCarsMarket />} />
            <Route path="/market/:id" element={<CarDetails />} />
            <Route path="/service" element={<ServiceCenter />} />
            <Route path="/service/:id" element={<ServiceCarDetails />} />
            <Route path="/showroom" element={<Showroom />} />
            <Route path="/arcade" element={<Arcade />} />
            <Route path="/upgrade/service" element={<UpgradeServiceCapacity />} />
            <Route path="/upgrade/showroom" element={<UpgradeShowroomCapacity />} />
            <Route path="/specialization" element={<Specialization />} />
        </Routes>
    ), [displayLocation.key]);

    return (
        <BalanceProvider>
            <PreloadAssets />
            <div
                ref={stackRef}
                className={`screen-stack${transitionLocation ? ' is-transitioning' : ''}`}
                style={lockHeight ? { height: lockHeight + 'px' } : undefined}
            >
                {/* Нижний слой — в потоке, задаёт реальную высоту */}
                <div ref={underRef} className={`screen-under ${underAnimClass}`}>
                    {underRoutes}
                </div>

                {/* Верхний слой — абсолют, едет поверх */}
                {transitionLocation && (
                    <div
                        ref={overRef}
                        key={transitionLocation.key}
                        className={`screen-over ${animClass}`}
                    >
                        <Routes location={transitionLocation}>
                            <Route path="/" element={<MainScreen />} />
                            <Route path="/market" element={<UsedCarsMarket />} />
                            <Route path="/market/:id" element={<CarDetails />} />
                            <Route path="/service" element={<ServiceCenter />} />
                            <Route path="/service/:id" element={<ServiceCarDetails />} />
                            <Route path="/showroom" element={<Showroom />} />
                            <Route path="/arcade" element={<Arcade />} />
                            <Route path="/upgrade/service" element={<UpgradeServiceCapacity />} />
                            <Route path="/upgrade/showroom" element={<UpgradeShowroomCapacity />} />
                            <Route path="/specialization" element={<Specialization />} />
                        </Routes>
                    </div>
                )}
            </div>
        </BalanceProvider>
    );
}
