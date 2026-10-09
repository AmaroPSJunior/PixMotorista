import React from 'react';

interface DriverAppProps {
  header: React.ReactNode;
  children: React.ReactNode;
  automotive?: boolean;
}

export const DriverApp: React.FC<DriverAppProps> = ({ header, children, automotive = false }) => (
  <div
    className={`min-h-screen font-sans pb-24 antialiased ${automotive ? 'bg-[#061724] text-white' : 'bg-slate-100/90 text-slate-800'}`}
    data-experience="driver"
    data-driver-layout={automotive ? 'automotive' : 'legacy'}
  >
    {header}
    {children}
  </div>
);
