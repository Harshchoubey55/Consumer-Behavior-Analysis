'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { tracker } from '../../lib/tracking/tracker';

export type InterventionState = 'NONE' | 'COMPARE_MATRIX' | 'PRICE_REFRAME';

interface ProductContext {
  id: string;
  name: string;
  price: number;
  category: string;
  features: string[];
}

interface InterventionContextType {
  intervention: InterventionState;
  clearIntervention: () => void;
  currentProduct: ProductContext | null;
  setCurrentProduct: (p: ProductContext | null) => void;
}

const InterventionContext = createContext<InterventionContextType>({
  intervention: 'NONE',
  clearIntervention: () => {},
  currentProduct: null,
  setCurrentProduct: () => {},
});

export const useIntervention = () => useContext(InterventionContext);

export function InterventionProvider({ children }: { children: React.ReactNode }) {
  const [intervention, setIntervention] = useState<InterventionState>('NONE');
  const [currentProduct, setCurrentProduct] = useState<ProductContext | null>(null);

  useEffect(() => {
    // Hook into the tracker's real-time risk scoring loop
    tracker.onRiskUpdate((result: any) => {
      if (result.intervention && result.intervention !== 'NONE') {
        setIntervention(result.intervention as InterventionState);
      }
    });
  }, []);

  const clearIntervention = () => setIntervention('NONE');

  return (
    <InterventionContext.Provider value={{ intervention, clearIntervention, currentProduct, setCurrentProduct }}>
      {children}
      {/* COMPARE_MATRIX — Dynamic product comparison */}
      {intervention === 'COMPARE_MATRIX' && currentProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
           <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
              <button 
                onClick={clearIntervention}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Compare Before You Decide</h3>
              <p className="text-slate-600 mb-6">
                You&apos;ve browsed several products. Here&apos;s how <strong>{currentProduct.name}</strong> stacks up:
              </p>
              
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex flex-col gap-3">
                 <div className="flex justify-between items-center text-sm border-b border-indigo-100 pb-2">
                    <span className="font-semibold text-slate-700">{currentProduct.name}</span>
                    <span className="text-indigo-600 font-bold">₹{currentProduct.price}</span>
                 </div>
                 {currentProduct.features.slice(0, 4).map((feature, i) => (
                    <div key={i} className="flex justify-between text-sm">
                       <span className="text-slate-500">{feature}</span>
                       <span className="font-medium text-green-600">✅</span>
                    </div>
                 ))}
                 <div className="flex justify-between text-sm border-t border-indigo-100 pt-2">
                    <span className="text-slate-500">Category</span>
                    <span className="font-medium text-slate-700">{currentProduct.category}</span>
                 </div>
              </div>

              <button 
                onClick={clearIntervention}
                className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-colors"
              >
                Continue Shopping
              </button>
           </div>
        </div>
      )}

      {/* PRICE_REFRAME — Dynamic value framing based on actual product */}
      {intervention === 'PRICE_REFRAME' && currentProduct && (
         <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900 text-white rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
             <button 
                onClick={clearIntervention}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                ✕
              </button>
              <h4 className="text-lg font-bold text-amber-400 mb-2">💡 Value Perspective</h4>
              <p className="text-sm text-slate-300">
                At <strong className="text-white">₹{currentProduct.price}</strong>, the{' '}
                <strong className="text-white">{currentProduct.name}</strong> averages just{' '}
                <strong className="text-amber-400">
                  ${(currentProduct.price / 365).toFixed(2)}/day
                </strong>{' '}
                over a year. It includes {currentProduct.features.length} premium features in the{' '}
                {currentProduct.category} category.
              </p>
         </div>
      )}
    </InterventionContext.Provider>
  );
}
