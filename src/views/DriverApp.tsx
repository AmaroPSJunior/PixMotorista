import React from 'react';

interface DriverAppProps {
  header: React.ReactNode;
  children: React.ReactNode;
}

export const DriverApp: React.FC<DriverAppProps> = ({ header, children }) => (
  <div
    className="min-h-screen bg-slate-100/90 text-slate-800 font-sans pb-24 antialiased"
    data-experience="driver"
  >
    {header}
    {children}
  </div>
);
