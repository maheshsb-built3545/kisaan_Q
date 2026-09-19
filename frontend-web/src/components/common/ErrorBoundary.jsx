import React from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown } from 'lucide-react';

/**
 * Robust React Error Boundary with Global and Per-Page fallback layouts.
 * Prevents white-screen crashes and isolates failures per page.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDevDetails: false
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary caught an error]:', error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (this.props.resetKey !== undefined && prevProps.resetKey !== this.props.resetKey) {
      if (this.state.hasError) {
        this.setState({ hasError: false, error: null, errorInfo: null });
      }
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const isPageLevel = this.props.level === 'page';
      const isDev = Boolean(import.meta.env?.DEV);

      if (isPageLevel) {
        return (
          <div className="min-h-[420px] flex items-center justify-center p-6 w-full">
            <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-5">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shadow-inner">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-black text-slate-900">
                  {this.props.title || 'Page Temporarily Unavailable'}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  We encountered an issue displaying this section. Other parts of the portal remain operational.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  Reload Page
                </button>
              </div>

              {isDev && this.state.error && (
                <div className="pt-3 text-left border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => this.setState((prev) => ({ showDevDetails: !prev.showDevDetails }))}
                    className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 flex items-center gap-1"
                  >
                    <span>Developer Error Details</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${this.state.showDevDetails ? 'rotate-180' : ''}`} />
                  </button>
                  {this.state.showDevDetails && (
                    <div className="mt-2 p-3 bg-slate-900 text-rose-300 font-mono text-[11px] rounded-xl overflow-x-auto max-h-40">
                      <p className="font-bold text-rose-400">{this.state.error.toString()}</p>
                      {this.state.errorInfo?.componentStack && (
                        <pre className="mt-1 text-[10px] text-slate-400 whitespace-pre-wrap">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      }

      // Full Global / App Shell Error Boundary
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 select-none relative overflow-hidden">
          {/* Top Tricolor Strip */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-white to-emerald-600" />

          <div className="max-w-lg w-full bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-xl">
              <AlertTriangle className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-2">
              <div className="inline-block px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">
                KisanQ Portal System Recovery
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Something went wrong
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                An unexpected condition interrupted the application session. You can reload the page or return to the main portal homepage.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-3 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Portal
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex-1 py-3 px-5 rounded-2xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                Return to Home
              </button>
            </div>

            {isDev && this.state.error && (
              <div className="pt-4 text-left border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => this.setState((prev) => ({ showDevDetails: !prev.showDevDetails }))}
                  className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 flex items-center gap-1.5"
                >
                  <span>[DEV ONLY] Diagnostics & Trace</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${this.state.showDevDetails ? 'rotate-180' : ''}`} />
                </button>
                {this.state.showDevDetails && (
                  <div className="mt-2.5 p-3.5 bg-black/80 border border-rose-950 text-rose-300 font-mono text-[11px] rounded-2xl overflow-x-auto max-h-56">
                    <p className="font-bold text-rose-400">{this.state.error.toString()}</p>
                    {this.state.errorInfo?.componentStack && (
                      <pre className="mt-2 text-[10px] text-slate-400 whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function PageErrorBoundary({ children, title, resetKey }) {
  return (
    <ErrorBoundary level="page" title={title} resetKey={resetKey}>
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
