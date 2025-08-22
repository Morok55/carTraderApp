import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/upgradesCapacity.css';
import UpgradeOption from '../components/UpgradeOption';
import UpgradeProgress from '../components/UpgradeProgress';
import { useBalance } from '../balance';

const SHOWROOM_CAPACITY_KEY = 'showroomCapacity';
const SHOWROOM_UPGRADE_KEY = 'showroomUpgrade'; // { endAt:number, delta:number }

function readCap() {
    try { return Number(localStorage.getItem(SHOWROOM_CAPACITY_KEY)) || 5; } catch { return 5; }
}
function writeCap(v) {
    try { localStorage.setItem(SHOWROOM_CAPACITY_KEY, String(v)); } catch {}
    try { window.dispatchEvent(new CustomEvent('capacity:showroom', { detail: v })); } catch {}
}

function readUpgrade() {
    try { return JSON.parse(localStorage.getItem(SHOWROOM_UPGRADE_KEY) || 'null'); } catch { return null; }
}
function writeUpgrade(obj) {
    if (!obj) {
        try { localStorage.removeItem(SHOWROOM_UPGRADE_KEY); } catch {}
        return;
    }
    try { localStorage.setItem(SHOWROOM_UPGRADE_KEY, JSON.stringify(obj)); } catch {}
}

export default function UpgradeShowroomCapacity() {
    const navigate = useNavigate();
    const { spend } = useBalance();

    const [cap, setCap] = useState(readCap());
    const [upgrade, setUpgrade] = useState(readUpgrade()); // null | { endAt, delta }
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        tg?.BackButton?.show();
        tg?.BackButton?.onClick(() => navigate('/', { replace: true }));
        return () => {
            tg?.BackButton?.offClick?.();
            tg?.BackButton?.hide?.();
        };
    }, [navigate]);

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        if (upgrade && upgrade.endAt <= now) {
            const newCap = cap + (upgrade.delta || 0);
            setCap(newCap);
            writeCap(newCap);
            setUpgrade(null);
            writeUpgrade(null);
        }
    }, [now, upgrade, cap]);

    function startUpgrade(delta, price, mins) {
        if (upgrade) return;
        const ok = spend(price);
        if (!ok) return;
        const endAt = Date.now() + Math.max(1, Math.round(mins)) * 60000;
        const rec = { endAt, delta };
        setUpgrade(rec);
        writeUpgrade(rec);
    }

    const remainMs = upgrade ? Math.max(0, upgrade.endAt - now) : 0;

    return (
        <div className="upg-screen upg--showroom">
            <div className="upg-hero upg-hero--showroom">
                <div className="upg-hero-title">Выставочный зал</div>
            </div>

            {upgrade ? (
                <UpgradeProgress theme="showroom" remainingMs={remainMs} />
            ) : (
                <div className="upg-list">
                    <UpgradeOption
                        theme="showroom"
                        icon="car"
                        iconCount={1}
                        title="Маленький зал"
                        delta={5}
                        price={20000}
                        current={cap}
                        durationMins={5}
                        inProgress={false}
                        remainingMs={0}
                        onStart={() => startUpgrade(5, 20000, 5)}
                    />
                    <UpgradeOption
                        theme="showroom"
                        icon="car"
                        iconCount={2}
                        title="Средний зал"
                        delta={10}
                        price={80000}
                        current={cap}
                        durationMins={10}
                        inProgress={false}
                        remainingMs={0}
                        onStart={() => startUpgrade(10, 80000, 10)}
                    />
                    <UpgradeOption
                        theme="showroom"
                        icon="car"
                        iconCount={3}
                        title="Большой зал"
                        delta={40}
                        price={1000000}
                        current={cap}
                        durationMins={40}
                        inProgress={false}
                        remainingMs={0}
                        onStart={() => startUpgrade(40, 1000000, 40)}
                    />
                </div>
            )}
        </div>
    );
}
