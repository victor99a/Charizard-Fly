import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className = '', ...props }) => {
  const baseStyles = "px-6 py-3 font-pixel text-sm uppercase transition-transform active:scale-95 shadow-lg border-2 rounded-lg";
  
  const variants = {
    primary: "bg-yellow-400 border-yellow-600 text-yellow-900 hover:bg-yellow-300",
    secondary: "bg-blue-500 border-blue-700 text-white hover:bg-blue-400",
    danger: "bg-red-500 border-red-700 text-white hover:bg-red-400"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};