import { useEffect } from 'react';
import carsData from '../data/carsData';

function readSpec() {
    try { return localStorage.getItem('specCurrent') || 'mass'; } catch { return 'mass'; }
}

function addLink(rel, attrs = {}) {
    try {
        const link = document.createElement('link');
        link.rel = rel;
        Object.entries(attrs).forEach(([k, v]) => link.setAttribute(k, v));
        document.head.appendChild(link);
    } catch {}
}

function prefetchImages(urls, concurrency = 4) {
    let i = 0;
    let inFlight = 0;

    function spawn() {
        while (inFlight < concurrency && i < urls.length) {
            const url = urls[i++];
            inFlight++;
            // hint для браузера
            addLink('prefetch', { as: 'image', href: url, importance: 'low' });
            // фактическая подгрузка
            try {
                const img = new Image();
                img.decoding = 'async';
                img.loading = 'eager';
                img.src = url;
                img.onload = img.onerror = () => {
                    inFlight--;
                    spawn();
                };
            } catch {
                inFlight--;
                spawn();
            }
        }
    }

    if ('requestIdleCallback' in window) {
        requestIdleCallback(() => spawn(), { timeout: 2000 });
    } else {
        setTimeout(spawn, 0);
    }
}

export default function PreloadAssets() {
    useEffect(() => {
        // Если экономия трафика включена — ничего не догружаем
        const conn = navigator.connection || navigator.webkitConnection || navigator.mozConnection;
        const saveData = !!(conn && conn.saveData);
        const slow = !!(conn && /2g|3g/.test(conn.effectiveType || ''));
        if (saveData || slow) return;

        const current = readSpec();
        const others = ['mass', 'lux', 'premium'].filter(s => s !== current);

        const urls = new Set();

        // 6 цветовых PNG — на всякий случай, если сплэш пропущен
        [
            '/img/car_arcade_black.png',
            '/img/car_arcade_blue.png',
            '/img/car_arcade_gray.png',
            '/img/car_arcade_red.png',
            '/img/car_arcade_white.png',
            '/img/car_arcade_yellow.png'
        ].forEach(u => urls.add(u));

        // Догружаем модели из двух «чужих» папок
        (carsData || []).forEach(m => {
            if (typeof m.image === 'string' && others.some(s => m.image.startsWith(`/img/${s}/`))) {
                urls.add(m.image);
            }
        });

        prefetchImages(Array.from(urls), 4);
    }, []);

    return null;
}
