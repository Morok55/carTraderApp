import carsData, { carsMass, carsLuxSport, carsPremium } from './carsData';

const STORAGE_KEY = 'marketCarsWithTime';
const TTL_HOURS = 5;
const SPEC_KEY = 'specCurrent';

function readSpec() {
    try { return localStorage.getItem(SPEC_KEY) || 'mass'; } catch { return 'mass'; }
}

function generateMarketCar(carModel) {
    // Выбираем общий уровень состояния (низкий, средний, высокий)
    const rand = Math.random();
    let min, max;

    if (rand < 0.3) {
        // Плохая машина
        min = 5;
        max = 30;
    } else if (rand < 0.7) {
        // Средняя
        min = 30;
        max = 70;
    } else {
        // Хорошая
        min = 70;
        max = 95;
    }

    // точное (реальное) состояние
    const conditionTrue = {
        engine: randomPercent(min, max),
        transmission: randomPercent(min, max),
        suspension: randomPercent(min, max),
        body: randomPercent(min, max),
        electrics: randomPercent(min, max),
        interior: randomPercent(min, max),
    };

    // витринное состояние = точное ±20% (в относительных %, с обрезкой 0..100)
    function noisy(v) {
        const k = 1 + (Math.random() * 0.4 - 0.2); // [-20% .. +20%]
        return Math.max(0, Math.min(100, Math.round(v * k)));
    }
    const displayCondition = Object.fromEntries(
        Object.entries(conditionTrue).map(([k, v]) => [k, noisy(v)])
    );

    const avgTrue        = Object.values(conditionTrue).reduce((a,b)=>a+b,0) / 6;
    const avgDisplay     = Object.values(displayCondition).reduce((a,b)=>a+b,0) / 6;

    // честная цена от реального состояния (опорная)
    const fairPrice      = Math.round(carModel.basePrice * (avgTrue / 100));

    // симметричный разброс сделки вокруг честной цены (покупка может быть и выгодной, и нет)
    function symmetricTriangular() {
        // распределение в [-1..1] со средним 0 (разница двух U(0,1))
        return Math.random() - Math.random();
    }
    const DEAL_SPREAD    = 0.18; // до ±18% от fairPrice
    const dealBias       = symmetricTriangular() * DEAL_SPREAD;
    const price          = Math.max(100, Math.round(fairPrice * (1 + dealBias))); // цена, по которой купим

    // на рынке показываем именно цену сделки
    const marketPrice    = price;

    return {
        id: crypto.randomUUID(),
        carId: carModel.id,
        name: `${carModel.brand} ${carModel.model}`,
        image: carModel.image,
        // точное и витринное состояние
        condition: conditionTrue,
        displayCondition,
        // цена сделки (её же показываем на рынке)
        price,               // по этой цене реально покупаем
        marketPrice: price,  // и её же видит пользователь
        // опорная база
        basePrice: carModel.basePrice,
        fairPrice,           // сохраняем для аналитики/отладки (можно не выводить)
    };
}

function randomRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPercent(min = 5, max = 95) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateMarketCars(count = 300) {
    const now = Date.now();
    const spec = readSpec();

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            const age = now - parsed.timestamp;
            if (parsed.spec === spec && age < TTL_HOURS * 60 * 60 * 1000) {
                return parsed.cars;
            }
        } catch {}
    }

    // выбираем пул моделей в зависимости от специализации
    const pool =
        spec === 'mass' ? (carsMass.length ? carsMass : carsData) :
        spec === 'lux'  ? (carsLuxSport.length ? carsLuxSport : carsData) :
                          (carsPremium.length ? carsPremium : carsData);

    const market = [];
    for (let i = 0; i < count; i++) {
        const model = pool[Math.floor(Math.random() * pool.length)];
        market.push(generateMarketCar(model));
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        timestamp: now,
        spec,
        cars: market
    }));

    return market;
}
