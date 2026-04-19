import { listProductsWithSort } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import HeroCarousel from "./hero-carousel"
import { Button, Heading, Text } from "@medusajs/ui"

export default async function Hero({ countryCode }: { countryCode: string }) {
  const {
    response: { products },
  } = await listProductsWithSort({
    page: 1,
    countryCode,
    sortBy: "created_at",
    queryParams: { limit: 12 },
  })

  const heroProducts = products.slice(0, 8)
  const region = await getRegion(countryCode)

  return (
    <section className="relative w-full border-b border-ui-border-base overflow-hidden bg-[#020617] text-white">
      {/* Galaxy gradient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -inset-32 bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.6),_transparent_60%),_radial-gradient(circle_at_bottom,_rgba(79,70,229,0.7),_transparent_55%),_radial-gradient(circle_at_left,_rgba(14,165,233,0.45),_transparent_55%)] opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/80" />
      </div>

      <div className="relative z-10 mx-auto flex h-[70vh] max-w-6xl flex-col justify-center px-6 py-16 small:px-10 md:flex-row md:items-center md:gap-16">
        {/* Copy */}
        <div className="max-w-xl space-y-6 text-center md:text-left">
          <Heading
            level="h1"
            className="text-3xl leading-tight tracking-tight text-white md:text-5xl"
          >
            Discover the
            <br className="hidden md:inline" />
            <span className="bg-gradient-to-r from-indigo-300 via-sky-300 to-fuchsia-300 bg-clip-text text-transparent">
              Galaxy Collection
            </span>
          </Heading>

          <Text className="text-sm text-white/80 md:text-base">
            Curated streetwear and essentials from your Medusa store, presented
            in a cosmic storefront experience. Browse drops, build your cart,
            and check out without leaving orbit.
          </Text>

          <div className="flex flex-col items-center gap-3 pt-3 sm:flex-row sm:justify-start">
            <Button
              asChild
              className="w-full max-w-xs bg-indigo-500 text-white hover:bg-indigo-400"
            >
              <a href="#products">Shop the collection</a>
            </Button>
            <Button
              variant="secondary"
              asChild
              className="w-full max-w-xs border-white/20 bg-white/5 text-slate-100 backdrop-blur hover:bg-white/10"
            >
              <a href="#categories">Explore categories</a>
            </Button>
          </div>

          <div className="flex items-center justify-center gap-4 pt-4 text-xs text-white/70 md:justify-start">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/30 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Live storefront
            </span>
            <span>Powered by Medusa &amp; Next.js</span>
          </div>
        </div>

        {/* Product carousel */}
        {region && heroProducts.length > 0 && (
          <div className="mt-10 hidden w-full max-w-md shrink-0 md:block">
            <HeroCarousel products={heroProducts} region={region} />
          </div>
        )}
      </div>
    </section>
  )
}
