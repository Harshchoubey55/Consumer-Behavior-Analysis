'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { tracker } from '../../lib/analytics/tracker';

export type InterventionState = 'NONE' | 'COMPARE_MATRIX' | 'PRICE_REFRAME';

interface InterventionContextType {
  intervention: InterventionState;
  clearIntervention: () => void;
}

const InterventionContext = createContext<InterventionContextType>({
  intervention: 'NONE',
  clearIntervention: () => {},
});

export const useIntervention = () => useContext(InterventionContext);

export function InterventionProvider({ children }: { children: React.ReactNode }) {
  const [intervention, setIntervention] = useState<InterventionState>('NONE');

  useEffect(() => {
    // Hook into the tracker's existing polling loop
    tracker.onRiskUpdate((result: any) => {
      if (result.intervention && result.intervention !== 'NONE') {
        // We actually only want to trigger the UI change once to prevent flashing,
        // so we'll set it here and it propagates to the whole app.
        setIntervention(result.intervention as InterventionState);
      }
    });
  }, []);

  const clearIntervention = () => setIntervention('NONE');

  return (
    <InterventionContext.Provider value={{ intervention, clearIntervention }}>
      {children}
      {/* Dynamic Popups based on intervention state */}
      {intervention === 'COMPARE_MATRIX' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
           <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
              <button 
                onClick={clearIntervention}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Feeling Stuck?</h3>
              <p className="text-slate-600 mb-6">You've looked at several products. Let's compare them side-by-side to make your decision easier.</p>
              
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex flex-col gap-4">
                 <div className="flex justify-between items-center text-sm">
                    <span className="font-semibold text-slate-700">Currently Viewing</span>
                    <span className="text-indigo-600 font-bold">Recommended</span>
                 </div>
                 {/* Fake comparison for the demo */}
                 <div className="flex justify-between">
                    <span className="text-slate-500">Feature A</span>
                    <span className="font-medium">✅ Yes</span>
                 </div>
                 <div className="flex justify-between border-t border-indigo-100 pt-3">
                    <span className="text-slate-500">Value Rating</span>
                    <span className="font-medium">⭐⭐⭐⭐⭐</span>
                 </div>
              </div>

              <button 
                onClick={clearIntervention}
                className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-colors"
              >
                Got it, thanks!
              </button>
           </div>
        </div>
      )}

      {intervention === 'PRICE_REFRAME' && (
         <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900 text-white rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
             <button 
                onClick={clearIntervention}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                ✕
              </button>
              <h4 className="text-lg font-bold text-amber-400 mb-2">Value Investment</h4>
              <p className="text-sm text-slate-300">
                While this item has a premium price, users rate its longevity 40% higher than alternatives, meaning lower cost per use over 5 years.
              </p>
         </div>
      )}
    </InterventionContext.Provider>
  );
}
