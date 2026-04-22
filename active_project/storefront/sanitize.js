const fs = require('fs');

const path = 'lib/products.ts';
let content = fs.readFileSync(path, 'utf8');

const imgMap = {
  'Fashion & Apparel': '/products/isolate_fashion.png',
  'Luxury Accessories': '/products/isolate_accessories.png',
  'Kitchen & Appliances': '/products/isolate_kitchen.png',
  'Electronics': '/products/isolate_electronics.png',
  'Furniture': '/products/isolate_furniture.png',
  'Footwear': '/products/isolate_footwear.png',
  'Fitness': '/products/category_fitness.png',
  'Home & Decor': '/products/category_decor.png',
  'Bags & Travel': '/products/category_bags.png',
  'Audio': '/products/headphones.png'
};

const regex = /category: '(.*?)',\s*categorySlug: '.*?',\s*description: '.*?',\s*features: \[.*?\],\s*image: '(https:\/\/loremflickr\.com.*?)'/g;

let count = 0;
const newContent = content.replace(regex, (match, category, oldImage) => {
  count++;
  const newImage = imgMap[category] || '/products/isolate_fashion.png';
  return match.replace(oldImage, newImage);
});

fs.writeFileSync(path, newContent, 'utf8');
console.log(`Replaced ${count} loremflickr images successfully.`);
