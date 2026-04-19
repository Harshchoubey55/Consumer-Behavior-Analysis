import { Metadata } from "next"

import Hero from "@modules/home/components/hero"
import PaginatedProducts from "@modules/store/templates/paginated-products"
import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"

export const metadata: Metadata = {
  title: "Medusa Next.js Starter Template",
  description:
    "A performant frontend ecommerce starter template with Next.js 15 and Medusa.",
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params

  const { countryCode } = params

  const region = await getRegion(countryCode)

  const { collections } = await listCollections({
    fields: "id, handle, title",
  })

  if (!collections || !region) {
    return null
  }

  return (
    <>
      <Hero countryCode={countryCode} />

      <section
        id="products"
        className="border-t border-slate-800/60 bg-gradient-to-b from-slate-950/60 via-slate-950/40 to-slate-950/20 py-16"
      >
        <div className="content-container space-y-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white md:text-3xl">
                All products
              </h2>
              <p className="text-sm text-white/75">
                Fresh drops and best sellers from across your Medusa catalog.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-y-12 gap-x-6">
            <PaginatedProducts
              sortBy="created_at"
              page={1}
              countryCode={countryCode}
            />
          </div>
        </div>
      </section>

      <section
        id="categories"
        className="border-t border-slate-800/60 bg-slate-950/40 py-16"
      >
        <div className="content-container space-y-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white md:text-3xl">
                Shop by collection
              </h2>
              <p className="text-sm text-white/75">
                Explore curated collections from your store.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {["sweatshirts", "shirts", "shorts", "sweatpants"].map((handle) => (
              <a
                key={handle}
                href={`/categories/${handle}`}
                className="group flex flex-col justify-between rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5 shadow-[0_0_40px_rgba(15,23,42,0.8)] transition hover:border-indigo-400/80 hover:bg-slate-900/90"
              >
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-white group-hover:text-indigo-100">
                    {handle.charAt(0).toUpperCase() + handle.slice(1)}
                  </h3>
                  <p className="text-xs text-white/75">
                    Explore all {handle} from your Medusa store.
                  </p>
                </div>
                <span className="mt-4 text-xs font-medium text-indigo-200">
                  View {handle} →
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
