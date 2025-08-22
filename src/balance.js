// balance.js
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const BALANCE_TEST_KEY = '__test_balance__';

const BalanceContext = createContext(null);

const readLS = () => {
    try { return Number(localStorage.getItem(BALANCE_TEST_KEY) || 0) || 0; } catch { return 0; }
};
const writeLS = (v) => {
    try { localStorage.setItem(BALANCE_TEST_KEY, String(v)); } catch {}
    // Сообщаем всем слушателям (и вкладкам)
    try { window.dispatchEvent(new CustomEvent('balance:change', { detail: v })); } catch {}
};

export const formatMoney = (n) =>
    (Number(n) || 0).toLocaleString('ru-RU');

function notifyInsufficient(need, have) {
    const msg = `Недостаточно средств.\nНужно: $ ${formatMoney(need)}\nДоступно: $ ${formatMoney(have)}`;
    const wa = window.Telegram && window.Telegram.WebApp;

    // не вызываем showPopup на старых версиях → не будет WebAppMethodUnsupported в консоли
    const canPopup = !!(wa
        && typeof wa.showPopup === 'function'
        && typeof wa.isVersionAtLeast === 'function'
        && wa.isVersionAtLeast('6.2'));

    if (canPopup) {
        try {
            wa.showPopup({ title: 'Недостаточно средств', message: msg });
            return;
        } catch (e) {
            // упадём в fallback ниже
        }
    }

    alert(msg);
}

export function BalanceProvider({ children }) {
    const [balance, setBalance] = useState(readLS());

    // синхронизация между вкладками/окнами и через CustomEvent
    useEffect(() => {
        const onStorage = (e) => { if (e.key === BALANCE_TEST_KEY) setBalance(readLS()); };
        const onCustom  = (e) => setBalance(e.detail);
        window.addEventListener('storage', onStorage);
        window.addEventListener('balance:change', onCustom);
        return () => {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener('balance:change', onCustom);
        };
    }, []);

    const set = useCallback((v) => { setBalance(v); writeLS(v); }, []);
    const add = useCallback((amt) => {
        if (!Number.isFinite(amt) || !amt) return;
        setBalance(prev => {
        const next = Math.max(0, prev + amt);
        writeLS(next);
        return next;
        });
    }, []);
    const spend = useCallback((amt) => {
        if (!Number.isFinite(amt) || amt <= 0) return true;
        const have = balance;
        if (have >= amt) {
            const next = have - amt;
            setBalance(next);
            writeLS(next);
            return true;
        }
        notifyInsufficient(amt, have);
        return false;
    }, [balance]);

    const canAfford = useCallback((amt) => balance >= (Number(amt) || 0), [balance]);

    const value = useMemo(() => ({ balance, setBalance: set, add, spend, canAfford }), [balance, set, add, spend, canAfford]);
    return <BalanceContext.Provider value={value}>{children}</BalanceContext.Provider>;
}

export const useBalance = () => {
    const ctx = useContext(BalanceContext);
    if (!ctx) {
        // на случай, если компонент смонтировали без провайдера
        return { balance: readLS(), setBalance: writeLS, add: () => {}, spend: () => false, canAfford: () => false };
    }
    return ctx;
};
