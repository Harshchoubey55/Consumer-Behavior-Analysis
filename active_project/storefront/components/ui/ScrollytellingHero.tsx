'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

export function ScrollytellingHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Smooth out the scroll physics for a more premium Apple feel
  const smoothProgress = useSpring(scrollYProgress, { damping: 20, stiffness: 100, mass: 0.2 });

  // 10 Full Categories Mapped across the 0 to 1 scroll scale
  const categories = [
    { id: 1, title: "Fashion & Apparel", slug: "fashion", image: "/products/canvas_belt.png" },
    { id: 2, title: "Luxury Accessories", slug: "accessories", image: "/products/smartwatch.png" },
    { id: 3, title: "Kitchen & Appliances", slug: "kitchen", image: "/products/coffee_maker.png" },
    { id: 4, title: "Electronics", slug: "electronics", image: "/products/smart_hub.png" },
    { id: 5, title: "Furniture", slug: "furniture", image: "/products/office_chair.png" },
    { id: 6, title: "Footwear", slug: "footwear", image: "/products/running_shoes.png" },
    { id: 7, title: "Fitness", slug: "fitness", image: "/products/yoga_mat.png" },
    { id: 8, title: "Home & Decor", slug: "home-decor", image: "/products/plant_pot.png" },
    { id: 9, title: "Bags & Travel", slug: "bags-travel", image: "/products/duffel_bag.png" },
    { id: 10, title: "Audio", slug: "audio", image: "/products/bluetooth_speaker.png" },
  ].map((cat, i, arr) => ({
    ...cat,
    centerIndex: i / (arr.length - 1)
  }));

  return (
    <section ref={containerRef} className="relative h-[1200vh] bg-black">
      <div className="sticky top-0 h-screen w-full flex overflow-hidden">
        
        {/* LEFT NAV: 3D Radial Wheel Anchors */}
        <div className="relative w-full md:w-[40%] h-full flex items-center bg-transparent z-30 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,rgba(120,113,108,0.05),transparent_40%)]" />
          
          <div className="relative w-full h-[60vh] flex flex-col justify-center">
            {categories.map((cat) => {
              const distance = useTransform(smoothProgress, (p) => p - cat.centerIndex);
              const y = useTransform(distance, [-0.5, 0, 0.5], [800, 0, -800]);
              const x = useTransform(distance, [-0.5, 0, 0.5], [-120, 20, -120]);
              const opacity = useTransform(distance, [-0.15, 0, 0.15], [0, 1, 0]);
              const scale = useTransform(distance, [-0.15, 0, 0.15], [0.6, 1, 0.6]);

              return (
                <motion.div
                  key={cat.id}
                  style={{ y, x, opacity, scale }}
                  className="absolute w-full flex flex-col items-start pl-10 md:pl-20 pointer-events-auto"
                >
                  <h2 className="text-4xl md:text-5xl lg:text-7xl font-display font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] mb-8">
                    {cat.title}
                  </h2>
                  <Link
                    href={`/search?q=${cat.slug}`}
                    className="btn-press rounded-full bg-white/10 backdrop-blur-3xl border border-white/20 px-8 py-4 text-[13px] font-bold text-white uppercase tracking-widest transition-all hover:bg-white hover:text-black hover:scale-[1.02] shadow-[0_0_20px_rgba(255,255,255,0.1)] relative z-50 cursor-pointer"
                  >
                    Explore Series
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* RIGHT CANVAS: Absolutely Seamless Ambient Subject Framing */}
        <div className="relative hidden md:block w-[60%] h-full bg-black z-10 pointer-events-none">
          {categories.map((cat, i) => {
             const startFadeIn = Math.max(0, cat.centerIndex - 0.1);
             const endFadeIn = cat.centerIndex;
             const startFadeOut = cat.centerIndex;
             const endFadeOut = Math.min(1, cat.centerIndex + 0.1);
             
             let alphaOutput = [0, 1, 0];
             let alphaInput = [startFadeIn, cat.centerIndex, endFadeOut];
             
             if (i === 0) {
                alphaInput = [0, 0.1];
                alphaOutput = [1, 0];
             }
             if (i === categories.length - 1) {
                alphaInput = [0.9, 1];
                alphaOutput = [0, 1];
             }

             const imgOpacity = useTransform(smoothProgress, alphaInput, alphaOutput);
             const imgScale = useTransform(smoothProgress, [startFadeIn, endFadeOut], [1.1, 1]);

             return (
               <motion.div
                 key={`img-${cat.id}`}
                 style={{ opacity: imgOpacity, scale: imgScale }}
                 className="absolute inset-0 flex items-center justify-center p-0"
               >
                 <div className="relative w-full h-[95vh] flex items-center justify-center">
                   <Image 
                     src={cat.image} 
                     alt={cat.title} 
                     fill 
                     className="object-contain opacity-80 mix-blend-screen transition-opacity duration-1000 scale-100"
                     priority={i < 2}
                     sizes="60vw"
                   />
                   {/* Massive Dramatic Vignette Overlay (Requested) */}
                   <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.85)_40%,#000000_65%)] pointer-events-none" />
                 </div>
               </motion.div>
             );
          })}
        </div>

      </div>
    </section>
  );
}
