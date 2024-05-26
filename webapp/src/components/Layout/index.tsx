import React from 'react';
import Navigation from '../Navigation';

type LayoutProps = {
  children: React.ReactNode;
};

const Layout = ({ children }: Readonly<LayoutProps>) => {
  return (
    <>
      <Navigation />
      <main style={{ height: '100vh', marginTop: '4rem' }}>
        {children}
      </main>
    </>
  );
};

export default Layout;
