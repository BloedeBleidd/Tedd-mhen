import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ApiProvider } from './lib/api';
import { App } from './App';
import './styles.css';
const router = createBrowserRouter([
  {
    path: '*',
    element: (
      <ApiProvider>
        <App />
      </ApiProvider>
    ),
  },
]);
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
