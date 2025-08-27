import React from 'react';
import '../css/splash.css';

export default function SplashScreen({ logo, progress = 0 }) {
    const pct = Math.round(progress * 100);

    return (
        <div className="splash-root">
            <img className="splash-logo" src={logo} alt="CAR TRADER PRO" />

            <div className="splash-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="splash-progress__fill" style={{ width: `${pct}%` }} />
                <div className="splash-progress__label">{pct}%</div>
            </div>
        </div>
    );
}
