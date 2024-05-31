import React, { useState } from 'react';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { routes } from '../router/routes';

const createRouter = () => {
  return createBrowserRouter(routes);
}

export const RouteProvider: React.FC = () => {

  const [router] = useState(createRouter());

    return <RouterProvider router={router}/>;
}