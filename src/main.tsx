import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { startGamepadMenuNav } from './game/gamepadMenu';

startGamepadMenuNav();

createRoot(document.getElementById('root')!).render(<App />);
