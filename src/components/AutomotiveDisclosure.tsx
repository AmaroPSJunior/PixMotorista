import React from 'react';
import { ChevronDown } from 'lucide-react';

interface AutomotiveDisclosureProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export const AutomotiveDisclosure: React.FC<AutomotiveDisclosureProps> = ({ title, description, children }) => (
  <details className="group rounded-3xl border border-slate-600 bg-slate-800/80 overflow-hidden">
    <summary className="list-none cursor-pointer min-h-20 px-5 sm:px-6 py-4 flex items-center justify-between gap-4 text-white focus-visible:outline focus-visible:outline-4 focus-visible:outline-sky-300">
      <span>
        <strong className="block text-lg sm:text-xl">{title}</strong>
        <span className="block text-sm text-slate-300 mt-1">{description}</span>
      </span>
      <ChevronDown className="w-7 h-7 shrink-0 group-open:rotate-180 transition-transform" aria-hidden="true" />
    </summary>
    <div className="bg-slate-100 px-3 sm:px-5 py-5 space-y-5 text-slate-900">{children}</div>
  </details>
);

export const DriverSection: React.FC<AutomotiveDisclosureProps & { automotive: boolean }> = ({
  automotive, title, description, children,
}) => automotive
  ? <AutomotiveDisclosure title={title} description={description}>{children}</AutomotiveDisclosure>
  : <>{children}</>;
