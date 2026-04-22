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
    
    // 1. REVERT ALL BROKEN TEMPLATE LITERALS: ₹{ -> ${
    content = content.replace(/₹\{/g, '${');

    // 2. Add Rupee sign instead of $ in UI manually since we know the context.
    // In React: >$ -> >₹
    content = content.replace(/>\$/g, '>₹');
    
    // Some are in template literals that represent prices, e.g. `$` + ${price} -> `₹${price}`
    content = content.replace(/`\$\$\{/g, '`₹${'); 
    // And earlier we had `\$` which might now be `$₹{` or something broken.
    // Let's just fix checkout line 305 specifically.
    content = content.replace(/`\$\$\{/g, '`₹${');
    content = content.replace(/`\$₹\{/g, '`₹${');

    // Any standalone ${ where it might be preceded by nothing, we don't touch unless it's explicitly rendering.
    // We already replaced >$ with >₹ which fixes most tags like <p>${price}</p> which was >${price}</p>
    // Actually, `<p>${price}</p>` doesn't have >$ in the source code. It has >${price}</p>.
    // So the source code is >${price}</p>.
    // If I do content.replace(/>\$\{/g, '>₹${') it will add the Rupee sign!
    content = content.replace(/>\$\{/g, '>₹${');

    // Also look for fixed price lines like 'Free' : '$4.99' or 'Free' : '$400' -> '₹400'
    content = content.replace(/'\$\d+(\.\d+)?'/g, match => match.replace('$', '₹'));

    // Fix explicit tracking strings if needed
    content = content.replace(/span>\$\{/g, 'span>₹${');
    content = content.replace(/strong>\$\{/g, 'strong>₹${');
    content = content.replace(/ — \$\{/g, ' — ₹${');

    fs.writeFileSync(p, content);
  }
});

console.log("Revert and proper formatting complete.");
