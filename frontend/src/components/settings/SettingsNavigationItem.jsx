import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export const SettingsNavigationItem = ({ to, onClick, icon: Icon, label, description, testId }) => {
  const commonClassName = 'group flex min-h-12 w-full items-center gap-3 px-4 py-3 border-b border-[#F0EFE9] last:border-b-0 hover:bg-[#F7F7F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#6B8067]/40';
  const content = (
    <>
      <div className="w-9 h-9 rounded-lg bg-[#EEF2EC] text-[#5F735B] flex items-center justify-center shrink-0">
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[13px] text-[#2C332F]">{label}</p>
        <p className="text-[11px] text-[#858C88] truncate mt-0.5">{description}</p>
      </div>
      <ChevronRight size={16} className="text-[#A0A79F] shrink-0" />
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        data-testid={testId}
        onClick={onClick}
        className={commonClassName}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      to={to}
      data-testid={testId}
      className={commonClassName}
    >
      {content}
    </Link>
  );
};
