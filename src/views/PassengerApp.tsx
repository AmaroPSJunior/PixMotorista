import React from 'react';

interface PassengerAppProps {
  header: React.ReactNode;
  children: React.ReactNode;
  automotive?: boolean;
}

export const PassengerApp: React.FC<PassengerAppProps> = ({ header, children }) => (
  <div
    className="min-h-screen bg-slate-100/90 text-slate-800 font-sans pb-24 antialiased"
    data-experience="passenger"
  >
    {header}
    {children}
  </div>
);
