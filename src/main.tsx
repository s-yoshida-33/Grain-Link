import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { setupAutoHideCursor } from './utils/autoHideCursor';

// 遠隔操作後にマウスカーソルが表示されたまま残らないよう、無操作時は自動で非表示にする
setupAutoHideCursor();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
