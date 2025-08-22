import { useEffect } from 'react';
import serviceBgUrl from '../img/upgrade_service.jpg';
import showroomBgUrl from '../img/upgrade_showroom.jpg';

// PNG аркады
import arcadePlayerPng from '../img/arcade_model_car.png';
import opp1Src from '../img/opponent_car_1.png';
import opp2Src from '../img/opponent_car_2.png';
import opp3Src from '../img/opponent_car_3.png';
import opp4Src from '../img/opponent_car_4.png';
import opp5Src from '../img/opponent_car_5.png';
import opp6Src from '../img/opponent_car_6.png';

function addLink(rel, attrs = {}) {
    try {
        const link = document.createElement('link');
        link.rel = rel;
        Object.entries(attrs).forEach(([k, v]) => link.setAttribute(k, v));
        document.head.appendChild(link);
    } catch {}
}

export default function PreloadAssets() {
    useEffect(() => {
        const urls = [
            serviceBgUrl,
            showroomBgUrl,
            arcadePlayerPng,
            opp1Src,
            opp2Src,
            opp3Src,
            opp4Src,
            opp5Src,
            opp6Src
        ];

        urls.forEach((url) => {
            addLink('preload', { as: 'image', href: url });

            try {
                const img = new Image();
                img.decoding = 'async';
                img.loading = 'eager';
                img.fetchPriority = 'high';
                img.src = url;
            } catch {}
        });
    }, []);

    return null;
}
