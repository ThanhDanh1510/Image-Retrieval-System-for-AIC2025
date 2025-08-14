import React, { useState } from "react";


const Button = ({ onSubmit, loading = false, disabled = false }) => {
  return (
    <div className="flex border border-slate-300 dark:border-gray-600 place-content-center bg-indigo-100 dark:bg-gray-900 p-4">
      <DrawOutlineButton onSubmit={onSubmit} loading={loading} disabled={disabled}>
        {loading ? "Submitting..." : "Submit API"}
      </DrawOutlineButton>
    </div>
  );
};

const DrawOutlineButton = ({ children, onSubmit, loading = false, disabled = false, ...rest }) => {
  const [isClicked, setIsClicked] = useState(false);
  const [showOutline, setShowOutline] = useState(false); // State cho outline effect

  const handleClick = () => {
    if (disabled || loading) return;
    
    setIsClicked((prev) => !prev);
    setShowOutline((prev) => !prev);
    
    // Thực hiện submit khi click
    if (onSubmit && typeof onSubmit === 'function') {
      onSubmit();
    }
  };

  return (
    <button
      {...rest}
      onClick={handleClick}
      disabled={disabled || loading}
      className={`group relative p-2 font-medium transition-colors duration-[400ms] 
        ${isClicked ? "text-indigo-500 dark:text-slate-100" : "text-indigo-500 dark:text-slate-100"}
        ${disabled || loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span>{children}</span>

      {/* TOP */}
      <span 
        className={`absolute left-0 top-0 h-[2px] bg-indigo-500 dark:bg-indigo-300 transition-all duration-100 
          ${showOutline ? "w-full" : "w-0"}`} 
      />

      {/* RIGHT */}
      <span 
        className={`absolute right-0 top-0 w-[2px] bg-indigo-500 dark:bg-indigo-300 transition-all delay-100 duration-100 
          ${showOutline ? "h-full" : "h-0"}`} 
      />

      {/* BOTTOM */}
      <span 
        className={`absolute bottom-0 right-0 h-[2.5px] bg-indigo-500 dark:bg-indigo-300 transition-all delay-200 duration-100 
          ${showOutline ? "w-full" : "w-0"}`} 
      />

      {/* LEFT */}
      <span 
        className={`absolute bottom-0 left-0 w-[3px] bg-indigo-500 dark:bg-indigo-300 transition-all delay-300 duration-100 
          ${showOutline ? "h-full" : "h-0"}`} 
      />
    </button>
  );
};

export default Button;
