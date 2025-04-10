import React from 'react';
import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
// import './index.css';

import './css/gemotery.css';

import UIWSController from './UIWSController';


function App() {

    return (
        <UIWSController />
    );

}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
