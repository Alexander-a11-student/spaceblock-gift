import QRCode from 'qrcode';
import { writeFile, mkdir } from 'node:fs/promises';
const url = process.argv[2];
if (!url?.startsWith('https://')) throw new Error('Pass the confirmed GitHub Pages URL');
await mkdir('print', { recursive: true });
await QRCode.toFile('print/SpaceBlock-QR.png', url, { errorCorrectionLevel: 'H', margin: 4, scale: 32, color: { dark: '#000000', light: '#ffffff' } });
await QRCode.toFile('print/SpaceBlock-QR.svg', url, { errorCorrectionLevel: 'H', margin: 4, type: 'svg', color: { dark: '#000000', light: '#ffffff' } });
await writeFile('print/README.txt', `SpaceBlock\n${url}\n\nПечать: чёрный QR на белом фоне. Рекомендуемый размер от 40 × 40 мм.\nСохраните белую рамку; не обрезайте и не растягивайте изображение.\n`);
console.log('QR saved: print/SpaceBlock-QR.png');
