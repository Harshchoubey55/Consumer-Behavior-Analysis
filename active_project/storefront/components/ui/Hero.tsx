'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';

export function Hero() {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 100]);
  const y2 = useTransform(scrollY, [0, 500], [0, -100]);

  return (
    <section className="relative overflow-hidden bg-black pt-32 pb-40">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-20%,rgba(120,113,108,0.15),transparent_60%)]" />
      
      <div className="relative mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-16 lg:gap-8">
          
          <motion.div 
            initial={{ opacity: 0, filter: 'blur(10px)', y: 40 }}
            animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-2xl z-20"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="inline-flex items-center rounded-full bg-white/5 px-4 py-1.5 mb-8 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/70 backdrop-blur-3xl border border-white/10"
            >
              <span className="mr-2 h-1.5 w-1.5 rounded-full bg-white/90 animate-pulse"></span>
              Next Generation Retail
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="text-6xl sm:text-7xl lg:text-[5.5rem] font-bold leading-[1.02] tracking-tighter text-white"
            >
              Profoundly<br />
              <span className="bg-gradient-to-br from-white via-stone-300 to-stone-600 bg-clip-text text-transparent pb-3 inline-block">
                powerful.
              </span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 1.2 }}
              className="mt-6 max-w-lg text-xl tracking-tight leading-relaxed text-stone-400 font-light"
            >
              Experience the intersection of masterful craftsmanship and behavioral intelligence. High-end essentials designed to perfect your routine.
            </motion.p>
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="mt-12 flex flex-wrap gap-4"
            >
              <Link
                href="/search"
                className="btn-press rounded-full bg-white px-8 py-4 text-[15px] font-semibold text-black transition-all hover:bg-stone-200 hover:scale-[1.02] shadow-[0_0_40px_rgba(255,255,255,0.15)]"
              >
                Buy Now
              </Link>
              <Link
                href="/search?q=new"
                className="btn-press rounded-full bg-white/10 px-8 py-4 text-[15px] font-semibold text-white transition-all hover:bg-white/20 backdrop-blur-xl border border-white/5"
              >
                Learn more
              </Link>
            </motion.div>
          </motion.div>

          {/* Floating Display Images */}
          <div className="relative w-full max-w-lg lg:block h-[500px] lg:h-[600px] mt-10 lg:mt-0 z-10 flex justify-center">
            <motion.div 
              style={{ y: y1 }}
              initial={{ opacity: 0, scale: 0.85, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 1.5, type: "spring", bounce: 0.1 }}
              className="absolute top-10 right-0 sm:right-10 z-20 h-72 w-72 md:h-[400px] md:w-[400px] rounded-3xl overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] border border-white/10"
            >
                <Image src="/products/headphones.png" alt="Headphones" fill className="object-cover bg-stone-100" />
            </motion.div>
            <motion.div 
              style={{ y: y2 }}
              initial={{ opacity: 0, scale: 0.85, x: -20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 1.5, type: "spring", bounce: 0.1 }}
              className="absolute bottom-10 left-0 sm:left-10 z-10 h-64 w-64 md:h-[350px] md:w-[350px] rounded-3xl overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] border border-white/10"
            >
                <Image src="/products/smartwatch.png" alt="Smartwatch" fill className="object-cover bg-stone-100" />
            </motion.div>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              transition={{ delay: 1, duration: 2 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-white/5 blur-[100px]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
