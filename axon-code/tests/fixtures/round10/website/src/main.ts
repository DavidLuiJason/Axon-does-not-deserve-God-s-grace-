import { checkout, items } from './catalog';
const receipt = checkout(10);
console.log('R10_WEBSITE_APP', JSON.stringify({ names: items.map((item) => item.name), ...receipt }));
export default receipt;
