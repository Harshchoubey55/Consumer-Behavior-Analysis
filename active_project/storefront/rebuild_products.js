const fs = require('fs');

const images = [
  'backpack.png', 'bluetooth_speaker.png', 'candle_set.png', 'canvas_belt.png',
  'chef_knife.png', 'coffee_dripper.png', 'coffee_maker.png', 'desk_converter.png',
  'desk_lamp.png', 'duffel_bag.png', 'espresso_machine.png', 'fashion_streetwear.png',
  'headphones.png', 'jump_rope.png', 'keyboard.png', 'luxury_watch.png',
  'office_chair.png', 'packing_cubes.png', 'plant_pot.png', 'resistance_bands.png',
  'running_shoes.png', 'slip_on_sneakers.png', 'smartwatch.png', 'smart_hub.png',
  'studio_headphones.png', 'sunglasses.png', 'throw_blanket.png', 'travel_mug.png',
  'wallet.png', 'wall_clock.png', 'water_bottle.png', 'winter_coat.png',
  'wireless_earbuds.png', 'yoga_mat.png'
];

function determineCategory(file) {
  if (file.includes('speaker') || file.includes('headphones') || file.includes('earbuds')) return { cat: 'Audio', slug: 'audio' };
  if (file.includes('backpack') || file.includes('duffel') || file.includes('cubes')) return { cat: 'Bags & Travel', slug: 'bags-travel' };
  if (file.includes('yoga') || file.includes('jump_rope') || file.includes('resistance_bands') || file.includes('water_bottle')) return { cat: 'Fitness', slug: 'fitness' };
  if (file.includes('shoes') || file.includes('sneakers')) return { cat: 'Footwear', slug: 'footwear' };
  if (file.includes('chair') || file.includes('desk_converter')) return { cat: 'Furniture', slug: 'furniture' };
  if (file.includes('coffee') || file.includes('espresso') || file.includes('chef_knife') || file.includes('mug')) return { cat: 'Kitchen & Appliances', slug: 'kitchen' };
  if (file.includes('watch') || file.includes('wallet') || file.includes('sunglasses')) return { cat: 'Luxury Accessories', slug: 'accessories' };
  if (file.includes('keyboard') || file.includes('smart_hub')) return { cat: 'Electronics', slug: 'electronics' };
  if (file.includes('candle') || file.includes('lamp') || file.includes('plant') || file.includes('blanket') || file.includes('clock')) return { cat: 'Home & Decor', slug: 'home-decor' };
  return { cat: 'Fashion & Apparel', slug: 'fashion' };
}

function formatName(file) {
  return file.replace('.png', '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

let code = `export type Product = {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  category: string;
  categorySlug: string;
  description: string;
  features: string[];
  image: string;
  rating: number;
  reviewCount: number;
  inStock: boolean;
};

export const PRODUCTS: Record<string, Product> = {\n`;

images.forEach((file, index) => {
  const c = determineCategory(file);
  const name = formatName(file);
  const idStr = (index + 1).toString().padStart(3, '0');
  const idKey = "prod_" + idStr;
  
  const price = Math.floor(Math.random() * 500) + 50;
  const original = Math.floor(Math.random() * 700) + 550;
  const rating = (Math.random() * 1 + 4).toFixed(1);
  const rw = Math.floor(Math.random() * 500) + 10;
  
  code += "  " + idKey + ": {\n";
  code += "    id: '" + idKey + "',\n";
  code += "    name: '" + name + "',\n";
  code += "    price: " + price + ",\n";
  code += "    originalPrice: " + original + ",\n";
  code += "    category: '" + c.cat + "',\n";
  code += "    categorySlug: '" + c.slug + "',\n";
  code += "    description: 'High quality " + name.toLowerCase() + " generated authentically by Antigravity.',\n";
  code += "    features: ['Premium Quality', 'Durable', 'Authentic Design', 'High Ratings'],\n";
  code += "    image: '/products/" + file + "',\n";
  code += "    rating: " + rating + ",\n";
  code += "    reviewCount: " + rw + ",\n";
  code += "    inStock: true,\n";
  code += "  },\n";
});

code += "};\n\n";
code += "export const PRODUCTS_LIST = Object.values(PRODUCTS);\n\n";

code += "export const CATEGORIES = [\n";
code += "  { slug: 'fashion', name: 'Fashion & Apparel', count: PRODUCTS_LIST.filter(p=>p.categorySlug==='fashion').length },\n";
code += "  { slug: 'accessories', name: 'Luxury Accessories', count: PRODUCTS_LIST.filter(p=>p.categorySlug==='accessories').length },\n";
code += "  { slug: 'kitchen', name: 'Kitchen & Appliances', count: PRODUCTS_LIST.filter(p=>p.categorySlug==='kitchen').length },\n";
code += "  { slug: 'electronics', name: 'Electronics', count: PRODUCTS_LIST.filter(p=>p.categorySlug==='electronics').length },\n";
code += "  { slug: 'furniture', name: 'Furniture', count: PRODUCTS_LIST.filter(p=>p.categorySlug==='furniture').length },\n";
code += "  { slug: 'footwear', name: 'Footwear', count: PRODUCTS_LIST.filter(p=>p.categorySlug==='footwear').length },\n";
code += "  { slug: 'fitness', name: 'Fitness', count: PRODUCTS_LIST.filter(p=>p.categorySlug==='fitness').length },\n";
code += "  { slug: 'home-decor', name: 'Home & Decor', count: PRODUCTS_LIST.filter(p=>p.categorySlug==='home-decor').length },\n";
code += "  { slug: 'bags-travel', name: 'Bags & Travel', count: PRODUCTS_LIST.filter(p=>p.categorySlug==='bags-travel').length },\n";
code += "  { slug: 'audio', name: 'Audio', count: PRODUCTS_LIST.filter(p=>p.categorySlug==='audio').length },\n";
code += "];\n\n";

code += "export function getProductsByCategory(slug: string): Product[] {\n";
code += "  return PRODUCTS_LIST.filter(index => index.categorySlug === slug);\n";
code += "}\n\n";

code += "export function searchProducts(query: string): Product[] {\n";
code += "  const lowercaseQuery = query.toLowerCase();\n";
code += "  return PRODUCTS_LIST.filter(product => \n";
code += "    product.name.toLowerCase().includes(lowercaseQuery) || \n";
code += "    product.category.toLowerCase().includes(lowercaseQuery) ||\n";
code += "    product.description.toLowerCase().includes(lowercaseQuery)\n";
code += "  );\n";
code += "}\n\n";

code += "export function getRelatedProducts(productId: string, limit = 4): Product[] {\n";
code += "  const currentProduct = PRODUCTS[productId];\n";
code += "  if (!currentProduct) return [];\n  \n";
code += "  return PRODUCTS_LIST\n";
code += "    .filter(p => p.id !== productId && p.categorySlug === currentProduct.categorySlug)\n";
code += "    .slice(0, limit);\n";
code += "}\n";

fs.writeFileSync('lib/products.ts', code, 'utf8');
console.log('Successfully rebuilt lib/products.ts using true 34 Gemini generated native images!');
