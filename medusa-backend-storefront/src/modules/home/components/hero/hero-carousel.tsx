"use client"

import { useEffect, useState } from "react"

import { HttpTypes } from "@medusajs/types"
import { getProductPrice } from "@lib/util/get-product-price"

type HeroCarouselProps = {
  products: HttpTypes.StoreProduct[]
  region: HttpTypes.StoreRegion
}

export default function HeroCarousel({ products, region }: HeroCarouselProps) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!products.length) {
      return
    }

    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % products.length)
    }, 3500)

    return () => clearInterval(id)
  }, [products.length])

  const current = products[index]
  const { cheapestPrice } = getProductPrice({ product: current })

  return (
    <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_0_60px_rgba(15,23,42,0.9)] backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-white">Trending now</span>
        <span className="text-xs text-slate-300">
          {index + 1} / {products.length}
        </span>
      </div>
      {current && (
        <div className="space-y-3">
          <div className="relative mx-auto h-40 w-full max-w-xs overflow-hidden rounded-2xl bg-slate-900/80">
            {current.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.thumbnail}
                alt={current.title}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {current.title}
              </p>
            </div>
            {cheapestPrice && (
              <p className="text-sm font-semibold text-indigo-100">
                {cheapestPrice.calculated_price}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
