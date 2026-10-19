import React from 'react';
import './i18n';
import { LanguageProvider } from './lib/language-context';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { ApiProvider } from './lib/api';
import { App } from './App';
import { PageError } from './components/PageError';
import { PublicDemo } from './pages/PublicDemo';
import { AuthorRedirect } from './components/AuthorRedirect';
import './styles.css';
import { AppearanceProvider } from './lib/appearance-context';
import {
  APPEARANCE_KEY,
  applyTheme,
  parseAppearance,
  readLocal,
  resolveAppearance,
} from './lib/appearance';
applyTheme(resolveAppearance(parseAppearance(readLocal(APPEARANCE_KEY)), new Date()).theme);
const router = createBrowserRouter([
  {
    errorElement: <PageError />,
    element: (
      <AppearanceProvider>
        <LanguageProvider>
          <Outlet />
        </LanguageProvider>
      </AppearanceProvider>
    ),
    children: [
      { path: '/about', element: <AuthorRedirect /> },
      { path: '/demo/about', element: <AuthorRedirect /> },
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
