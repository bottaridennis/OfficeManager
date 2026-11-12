import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useOnboarding } from '../contexts/OnboardingContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  X, 
  CheckCircle2, 
  Layers, 
  Smartphone, 
  Package, 
  FileSignature, 
  Ticket, 
  User, 
  Barcode, 
  TrendingUp,
  ShieldCheck
} from 'lucide-react';

export default function OnboardingTour() {
  const { 
    isActive, 
    currentStepIndex, 
    currentStep, 
    totalSteps,
    nextStep, 
    prevStep, 
    skipOnboarding,
    goToStep 
  } = useOnboarding();

  const navigate = useNavigate();
  const location = useLocation();

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Sync route if current step requires a specific page
  useEffect(() => {
    if (!isActive || !currentStep) return;

    if (currentStep.path && location.pathname !== currentStep.path) {
      navigate(currentStep.path);
    }
  }, [isActive, currentStep, location.pathname, navigate]);

  // Track target element coordinates
  const updatePosition = useCallback(() => {
    if (!isActive || !currentStep) {
      setTargetRect(null);
      return;
    }

    if (currentStep.targetId === 'welcome-center') {
      setTargetRect(null);
      return;
    }

    const el = document.getElementById(currentStep.targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [isActive, currentStep]);

  useEffect(() => {
    if (!isActive || !currentStep) return;

    updatePosition();
    const t1 = setTimeout(updatePosition, 100);
    const t2 = setTimeout(updatePosition, 350);
    const t3 = setTimeout(updatePosition, 700);
    const interval = setInterval(updatePosition, 1000);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearInterval(interval);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isActive, currentStep, location.pathname, updatePosition]);

  // Calculate tooltip coordinates relative to target element
  useEffect(() => {
    if (!currentStep) {
      setTooltipPos(null);
      return;
    }

    const padding = 16;
    const tooltipWidth = 380;
    const tooltipHeight = 260; // approximate
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (!targetRect) {
      // Graceful fallback to bottom-center if element is not in DOM yet
      setTooltipPos({
        top: Math.max(30, viewportHeight - tooltipHeight - 40),
        left: Math.max(16, (viewportWidth - tooltipWidth) / 2)
      });
      return;
    }

    let top = 0;
    let left = 0;

    switch (currentStep.position) {
      case 'bottom':
        top = targetRect.bottom + padding;
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        break;
      case 'top':
        top = targetRect.top - tooltipHeight - padding;
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        break;
      case 'left':
        top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
        left = targetRect.left - tooltipWidth - padding;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
        left = targetRect.right + padding;
        break;
      default:
        top = targetRect.bottom + padding;
        left = targetRect.left;
    }

    // Keep within viewport boundaries
    if (left < 16) left = 16;
    if (left + tooltipWidth > viewportWidth - 16) {
      left = viewportWidth - tooltipWidth - 16;
    }
    if (top < 16) top = 16;
    if (top + tooltipHeight > viewportHeight - 16) {
      top = Math.max(16, targetRect.top - tooltipHeight - padding);
      if (top < 16) top = 16;
    }

    setTooltipPos({ top, left });
  }, [targetRect, currentStep]);

  if (!isActive || !currentStep) return null;

  const progressPercent = ((currentStepIndex + 1) / totalSteps) * 100;

  // STEP 1: Modal Centrale di Benvenuto
  if (currentStepIndex === 0 || currentStep.targetId === 'welcome-center' && currentStepIndex === 0) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Dark backdrop */}
        <div 
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-in cursor-pointer" 
          onClick={skipOnboarding}
        />

        <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden z-10 animate-in">
          
          {/* Header decorative banner */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-6 text-white relative">
            <button 
              onClick={skipOnboarding}
              className="absolute top-4 right-4 p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              title="Chiudi tour"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center mb-3 shadow-inner ring-1 ring-white/30">
              <Sparkles className="w-6 h-6 text-amber-300" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-semibold tracking-wide uppercase mb-2">
              <span>Guida Operativa Completa</span>
              <span>•</span>
              <span>Tutte le Aree ({totalSteps} Punti)</span>
            </div>

            <h2 className="text-xl font-bold tracking-tight text-white leading-snug">
              {currentStep.title}
            </h2>
          </div>

          <div className="p-6">
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-5 font-medium">
              {currentStep.microcopy}
            </p>

            {/* Quick module feature matrix */}
            <div className="grid grid-cols-3 gap-2.5 mb-6 bg-slate-50 p-3 rounded-2xl border border-slate-200/70">
              <div className="text-center p-2 rounded-xl bg-white border border-slate-100 shadow-2xs">
                <Smartphone className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                <div className="text-[11px] font-bold text-slate-800">Hardware & QR</div>
                <div className="text-[10px] text-slate-400">Parco PC & Monitor</div>
              </div>
              <div className="text-center p-2 rounded-xl bg-white border border-slate-100 shadow-2xs">
                <Package className="w-4 h-4 text-indigo-600 mx-auto mb-1" />
                <div className="text-[11px] font-bold text-slate-800">Consumabili</div>
                <div className="text-[10px] text-slate-400">Scorte & Restock</div>
              </div>
              <div className="text-center p-2 rounded-xl bg-white border border-slate-100 shadow-2xs">
                <Ticket className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                <div className="text-[11px] font-bold text-slate-800">Ticket & Prestiti</div>
                <div className="text-[10px] text-slate-400">Assistenza & Resi</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-5">
              <div 
                className="bg-blue-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={skipOnboarding}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600 px-3 py-2 transition-colors cursor-pointer"
              >
                Salta guida
              </button>

              <button
                type="button"
                onClick={nextStep}
                className="btn btn-primary h-10"
              >
                <span>{currentStep.nextLabel || 'Inizia il tour (1 min)'}</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STEP FINALE: Modal di Conclusione e Successo
  if (currentStepIndex === totalSteps - 1) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div 
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-in cursor-pointer" 
          onClick={skipOnboarding}
        />

        <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden z-10 animate-in text-center">
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-8 text-white relative">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto mb-3 shadow-inner ring-1 ring-white/30 animate-bounce">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white mb-1">
              {currentStep.title}
            </h2>
            <p className="text-emerald-100 text-xs font-medium max-w-sm mx-auto">
              Hai completato la panoramica di tutte le sezioni aziendali.
            </p>
          </div>

          <div className="p-6">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-left mb-6 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Accesso rapido a tutte le funzionalità configurato</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Puoi sempre ripassare questa guida cliccando su <strong>"Rifai Tutorial"</strong> nella barra superiore o nella barra laterale.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={prevStep}
                className="h-10 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Indietro</span>
              </button>

              <button
                type="button"
                onClick={skipOnboarding}
                className="h-10 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/25 flex items-center gap-2 cursor-pointer"
              >
                <span>{currentStep.nextLabel || 'Concludi e Inizia'}</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STEP INTERMEDI (2 .. N-1): Spotlight Overlay & Tooltip
  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      
      {/* SVG Spotlight Mask */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="onboarding-mask">
            {/* White covers everything (visible dark overlay) */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            
            {/* Target element cut-out with padding and rounded corners */}
            {targetRect && (
              <rect
                x={targetRect.left - 6}
                y={targetRect.top - 6}
                width={targetRect.width + 12}
                height={targetRect.height + 12}
                rx="14"
                ry="14"
                fill="black"
              />
            )}
          </mask>
        </defs>

        {/* Semi-transparent dark overlay */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(11, 17, 32, 0.65)"
          mask="url(#onboarding-mask)"
        />
      </svg>

      {/* Pulsing ring around the highlighted target element */}
      {targetRect && (
        <div 
          className="absolute border-2 border-blue-500 rounded-2xl pointer-events-none shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all duration-300"
          style={{
            top: `${targetRect.top - 6}px`,
            left: `${targetRect.left - 6}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
          }}
        >
          <span className="absolute -top-2.5 -right-2.5 flex h-5 w-5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-5 w-5 bg-blue-600 text-white text-[10px] font-bold items-center justify-center font-mono shadow-sm">
              {currentStepIndex + 1}
            </span>
          </span>
        </div>
      )}

      {/* Floating Anchored Tooltip */}
      {tooltipPos && (
        <div
          ref={tooltipRef}
          className="absolute z-20 w-[360px] sm:w-[380px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden pointer-events-auto transition-all duration-200 animate-in fade-in zoom-in-95"
          style={{
            top: `${tooltipPos.top}px`,
            left: `${tooltipPos.left}px`,
          }}
        >
          {/* Tooltip Header */}
          <div className="px-5 pt-4 pb-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center font-mono shadow-2xs">
                {currentStepIndex + 1}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Punto {currentStepIndex + 1} di {totalSteps}
              </span>
              {currentStep.badge && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {currentStep.badge}
                </span>
              )}
            </div>

            <button
              onClick={skipOnboarding}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
              title="Chiudi tutorial"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Microcopy Content */}
          <div className="p-5">
            <h3 className="font-bold text-slate-900 text-sm leading-snug mb-1.5">
              {currentStep.title}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              {currentStep.microcopy}
            </p>

            {/* Step navigation dots bar */}
            <div className="flex items-center justify-center gap-1.5 my-4">
              {Array.from({ length: totalSteps }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => goToStep(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === currentStepIndex 
                      ? 'w-6 bg-blue-600' 
                      : idx < currentStepIndex 
                        ? 'w-2 bg-blue-300' 
                        : 'w-2 bg-slate-200'
                  }`}
                  aria-label={`Passo ${idx + 1}`}
                  title={`Passo ${idx + 1}`}
                />
              ))}
            </div>

            {/* Action Bar with Next and Prev */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={prevStep}
                disabled={currentStepIndex === 0}
                className="h-8 px-3 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Indietro</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={nextStep}
                  className="btn btn-primary"
                >
                  <span>{currentStep.nextLabel || 'Avanti'}</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
