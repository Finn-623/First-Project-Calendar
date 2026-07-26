import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const SettingsSubpageHeader = ({ title, description }) => {
  const navigate = useNavigate();

  return (
    <header className="mb-4">
      <button
        type="button"
        onClick={() => navigate('/settings')}
        aria-label="返回设置"
        className="min-h-11 px-2 -ml-2 rounded-lg text-[13px] text-[#6B8067] hover:bg-[#EEF2EC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8067]/40 inline-flex items-center gap-1.5"
      >
        <ArrowLeft size={16} />
        返回设置
      </button>

      <h1 className="text-[20px] font-medium text-[#2C332F] mt-2">{title}</h1>
      {description ? <p className="text-[12px] text-[#858C88] mt-1">{description}</p> : null}
    </header>
  );
};
