import React from 'react';
import ReactDOM from 'react-dom/client';
import './css/main.css';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';


// Создаём корневой React root
const root = ReactDOM.createRoot(document.getElementById('root'));

// Рендерим приложение
root.render(
    <BrowserRouter>
        <App />
        <Analytics />
    </BrowserRouter>
);