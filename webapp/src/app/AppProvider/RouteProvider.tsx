import React, { useState } from 'react';
import { RouterProvider, createHashRouter } from 'react-router-dom';
import { routes } from '../router/routes';

const createRouter = () => {
  return createHashRouter(routes);
}

export const RouteProvider: React.FC = () => {
  const [router] = useState(createRouter());
  return <RouterProvider router={router} />;
}
