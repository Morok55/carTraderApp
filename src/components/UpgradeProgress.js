// components/UpgradeProgress.js
import React from 'react';
import { FaRegClock } from 'react-icons/fa';

function fmtRemain(ms) {
    const t = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    const mm = m < 10 ? ' ' + m : String(m);
    const ss = s < 10 ? '0' + s : String(s);
    return `${h} ч. ${mm} мин. ${ss} сек.`;
}

export default function UpgradeProgress({ theme, remainingMs, title = 'Расширение в процессе', subtitle = 'Оставшееся время' }) {
    return (
        <div className={['upg-progress', theme === 'service' ? 'upg-progress--service' : 'upg-progress--showroom'].join(' ')}>
            <div className="upg-prog-header">
                <FaRegClock className="upg-prog-ico" />
                <span className="upg-prog-title">{title}</span>
            </div>

            <div className="upg-prog-time">{fmtRemain(remainingMs)}</div>
            <div className="upg-prog-sub">{subtitle}</div>
        </div>
    );
}
