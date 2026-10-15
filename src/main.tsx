import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { ApiProvider } from './lib/api';
import { App } from './App';
import { PublicDemo } from './pages/PublicDemo';
import './styles.css';
import { AppearanceProvider } from './lib/appearance-context';
import {
  APPEARANCE_KEY,
  applyTheme,
  parseAppearance,
  readLocal,
  resolveAppearance,
} from './lib/appearance';
applyTheme(
  resolveAppearance(
    parseAppearance(readLocal(APPEARANCE_KEY)),
    new Date(),
    matchMedia('(prefers-color-scheme: dark)').matches,
  ).theme,
);
const router = createBrowserRouter([
  {
    element: (
      <AppearanceProvider>
        <Outlet />
      </AppearanceProvider>
    ),
    children: [
      { path: '/demo/*', element: <PublicDemo /> },
      {
        path: '*',
        element: (
          <ApiProvider>
            <App />
          </ApiProvider>
        ),
      },
    ],
  },
]);
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
