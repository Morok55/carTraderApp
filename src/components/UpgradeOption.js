import React from 'react';
import { FaScrewdriverWrench } from 'react-icons/fa6';
import { FaCarSide } from 'react-icons/fa';
import { useBalance } from '../balance';

function fmtPrice(n) {
    const v = Number(n) || 0;
    return v.toLocaleString('ru-RU');
}

function fmtRemain(ms) {
    const t = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(t / 60);
    const s = t % 60;
    const ss = s < 10 ? '0' + s : String(s);
    return `${m}:${ss}`;
}

export default function UpgradeOption({
    theme,
    icon,
    iconCount,
    title,
    delta,
    price,
    current,
    durationMins,
    inProgress,
    remainingMs,
    onStart
}) {
    const { canAfford } = useBalance();
    const locked = !canAfford(price) && !inProgress;

    function renderIcons() {
        const Ico = icon === 'wrench' ? FaScrewdriverWrench : FaCarSide;
        const arr = Array.from({ length: iconCount });
        return (
            <div className="uopt-icons">
                {arr.map((_, i) => <Ico key={i} className="uopt-ico" />)}
            </div>
        );
    }

    return (
        <button
            className={[
                'uopt-card',
                theme === 'service' ? 'uopt--service' : 'uopt--showroom',
                locked ? 'is-locked' : ''
            ].join(' ').trim()}
            onClick={() => {
                if (inProgress || locked) return;
                onStart();
            }}
        >
            {renderIcons()}
            <div className="uopt-title">{title}</div>

            {!inProgress && (
                <div className="uopt-places">
                    Добавит: {delta} мест (будет {current + delta}) · {durationMins} мин
                </div>
            )}

            {inProgress && (
                <div className="uopt-badge">
                    В процессе · осталось {fmtRemain(remainingMs)}
                </div>
            )}

            <div className="uopt-price">$ {fmtPrice(price)}</div>
        </button>
    );
}
