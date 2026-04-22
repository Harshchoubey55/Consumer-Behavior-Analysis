const fs = require('fs');
const path = require('path');

const base = 'd:\\Users\\zeroe\\Desktop\\Consumer-Behavior-Analysis\\active_project\\storefront';

const uiFiles = [
  'app/page.tsx', 
  'components/ui/ProductCard.tsx', 
  'components/ui/QuickView.tsx', 
  'components/ui/RecentlyViewed.tsx', 
  'app/product/[handle]/page.tsx', 
  'components/cart/CartProvider.tsx', 
  'app/checkout/page.tsx', 
  'app/wishlist/page.tsx', 
  'app/search/page.tsx',
  'components/tracking/InterventionProvider.tsx'
];

uiFiles.forEach(f => {
  const p = path.join(base, f);
  if(fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    content = content.replace(/\$50/g, '₹4000');
    content = content.replace(/\$4.99/g, '₹400');
    content = content.replace(/\$\{/g, '₹{');
    content = content.replace(/'\$'/g, "'₹'");
    content = content.replace(/>\$/g, '>₹');
    content = content.replace(/"\$"/g, '"₹"');
    fs.writeFileSync(p, content);
    console.log("Updated UI file:", f);
  } else {
    console.log("Missing UI file:", f);
  }
});

// Update products.ts prices
const productsFile = path.join(base, 'lib/products.ts');
if(fs.existsSync(productsFile)) {
  let pContent = fs.readFileSync(productsFile, 'utf8');
  
  // Replace price: X -> price: X * 83
  pContent = pContent.replace(/price: (\d+),/g, (match, p1) => {
    return `price: ${parseInt(p1) * 83},`;
  });
  
  // Replace originalPrice: X -> originalPrice: X * 83
  pContent = pContent.replace(/originalPrice: (\d+),/g, (match, p1) => {
    return `originalPrice: ${parseInt(p1) * 83},`;
  });

  fs.writeFileSync(productsFile, pContent);
  console.log("Updated products.ts prices.");
}

console.log("Currency fix complete.");
