import React from 'react';

export const Input = ({
  label,
  error,
  helperText,
  icon: Icon = null,
  rightElement = null,
  type = 'text',
  options = [],
  className = '',
  id,
  required = false,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-2">
      {label && (
        <label htmlFor={inputId} className="block text-base font-bold text-slate-800 tracking-tight">
          {label} {required && <span className="text-emerald-600 font-extrabold">*</span>}
        </label>
      )}

      <div className="relative rounded-2xl">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
            <Icon className="w-5 h-5" />
          </div>
        )}

        {type === 'select' ? (
          <select
            id={inputId}
            className={`w-full bg-white border-2 ${
              error ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-500/20'
            } rounded-2xl ${Icon ? 'pl-12' : 'pl-4'} pr-10 py-3.5 text-slate-900 font-semibold text-base sm:text-lg appearance-none transition-all duration-200 focus:outline-none focus:ring-4 disabled:opacity-50 disabled:bg-slate-100 shadow-sm ${className}`}
            {...props}
          >
            {options.map((opt) => {
              const val = typeof opt === 'object' ? opt.value : opt;
              const lbl = typeof opt === 'object' ? opt.label : opt;
              return (
                <option key={val} value={val} className="bg-white text-slate-900 text-base py-2">
                  {lbl}
                </option>
              );
            })}
          </select>
        ) : type === 'textarea' ? (
          <textarea
            id={inputId}
            className={`w-full bg-white border-2 ${
              error ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-500/20'
            } rounded-2xl ${Icon ? 'pl-12' : 'pl-4'} pr-4 py-3.5 text-slate-900 font-semibold text-base sm:text-lg placeholder-slate-400 transition-all duration-200 focus:outline-none focus:ring-4 disabled:opacity-50 disabled:bg-slate-100 resize-none shadow-sm ${className}`}
            {...props}
          />
        ) : (
          <input
            id={inputId}
            type={type}
            className={`w-full bg-white border-2 ${
              error ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-500/20'
            } rounded-2xl ${Icon ? 'pl-12' : 'pl-4'} ${rightElement ? 'pr-12' : 'pr-4'} py-3.5 text-slate-900 font-semibold text-base sm:text-lg placeholder-slate-400 transition-all duration-200 focus:outline-none focus:ring-4 disabled:opacity-50 disabled:bg-slate-100 shadow-sm ${className}`}
            {...props}
          />
        )}

        {rightElement && (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
            {rightElement}
          </div>
        )}
      </div>

      {error ? (
        <p className="text-sm font-bold text-rose-600 flex items-center gap-1.5 mt-1">
          <span>⚠</span> {error}
        </p>
      ) : helperText ? (
        <p className="text-sm font-medium text-slate-600 mt-1">{helperText}</p>
      ) : null}
    </div>
  );
};

export default Input;
