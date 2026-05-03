import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/marketing.css';
import './styles/scraper.css';
import ScraperPanel from './components/scraper/ScraperPanel';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ScraperPanel />
  </React.StrictMode>
);
