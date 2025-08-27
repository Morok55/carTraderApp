import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route, useLocation, useNavigationType } from 'react-router-dom';
import './css/main.css';
import carsData from './data/carsData';
import { BalanceProvider } from './balance';
import PreloadAssets from './components/PreloadAssets';
import SplashScreen from './components/SplashScreen';

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

// Картинки из src/img, которые должны загрузиться до входа в приложение
import serviceBgUrl from './img/upgrade_service.jpg';
import showroomBgUrl from './img/upgrade_showroom.jpg';
import arcadePlayerPng from './img/arcade_model_car.png';
import opp1Src from './img/opponent_car_1.png';
import opp2Src from './img/opponent_car_2.png';
import opp3Src from './img/opponent_car_3.png';
import opp4Src from './img/opponent_car_4.png';
import opp5Src from './img/opponent_car_5.png';
import opp6Src from './img/opponent_car_6.png';

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

    const [bootReady, setBootReady] = useState(false);
    const [splashReady, setSplashReady] = useState(false);
    const [minDelayPassed, setMinDelayPassed] = useState(false);
    const [bootProgress, setBootProgress] = useState(0); // 0..1

    function preloadOne(url, onDone) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = img.onerror = () => { onDone && onDone(url); resolve(url); };
            img.decoding = 'async';
            img.loading = 'eager';
            img.src = url;
        });
    }

    function buildBootList() {
        const spec = (localStorage.getItem('specCurrent') || 'mass').trim();

        const urls = new Set();

        // 1) src/img (модульные импорты)
        [
            serviceBgUrl, showroomBgUrl,
            arcadePlayerPng,
            opp1Src, opp2Src, opp3Src, opp4Src, opp5Src, opp6Src
        ].forEach(u => urls.add(u));

        // 2) public/img — 6 верхнеуровневых PNG-цветов
        [
            '/img/car_arcade_black.png',
            '/img/car_arcade_blue.png',
            '/img/car_arcade_gray.png',
            '/img/car_arcade_red.png',
            '/img/car_arcade_white.png',
            '/img/car_arcade_yellow.png'
        ].forEach(u => urls.add(u));

        // 3) public/img — загружаем только ПАПКУ текущей специализации
        // Берём пути из carsData.image, которые лежат в /img/{spec}/...
        (carsData || []).forEach(m => {
            if (m.image && typeof m.image === 'string' && m.image.startsWith(`/img/${spec}/`)) {
                urls.add(m.image);
            }
        });

        return Array.from(urls);
    }

    useEffect(() => {
        // Логотип мы уже подгружаем в index.html, поэтому сразу запускаем прелоад ассетов
        setSplashReady(true);
    }, []);

    // 2) Когда логотип готов — грузим остальное и держим экран загрузки
    useEffect(() => {
        if (!splashReady) return;
        let aborted = false;

        const urls = buildBootList();
        const total = urls.length;

        if (total === 0) {
            setBootProgress(1);
            setBootReady(true);
            return;
        }

        let done = 0;
        const onDone = () => {
            done += 1;
            if (!aborted) setBootProgress(done / total);
        };

        Promise.all(urls.map(u => preloadOne(u, onDone))).then(() => {
            if (!aborted) {
                setBootProgress(1);
                setBootReady(true);
            }
        });

        return () => { aborted = true; };
    }, [splashReady]);

    // Минимальное время показа сплэша — 1 сек
    useEffect(() => {
        const t = setTimeout(() => setMinDelayPassed(true), 1000);
        return () => clearTimeout(t);
    }, []);

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
            {!(bootReady && minDelayPassed) ? (
                <SplashScreen logo={"/img/splash_logo.png"} progress={bootProgress} />
            ) : (
                <>
                    <PreloadAssets />
                    <div
                        ref={stackRef}
                        className={`screen-stack${transitionLocation ? ' is-transitioning' : ''}`}
                        style={lockHeight ? { height: lockHeight + 'px' } : undefined}
                    >
                        <div ref={underRef} className={`screen-under ${underAnimClass}`}>
                            {underRoutes}
                        </div>

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
                </>
            )}
        </BalanceProvider>
    );
}
