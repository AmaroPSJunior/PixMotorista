import QRCode from 'qrcode';

export type QrCodeThemeType = 'pix' | 'spotify' | 'wifi' | 'charger' | 'main_app';

export interface QrCodeThemeConfig {
  darkColor: string;
  lightColor: string;
  iconSvg: string;
  badgeBg: string;
  badgeBorder: string;
}

// Color schemes and SVG icons per feature
export const QR_THEMES: Record<QrCodeThemeType, QrCodeThemeConfig> = {
  pix: {
    darkColor: '#037A68', // Pix Teal Green (Dark & High Contrast)
    lightColor: '#FFFFFF',
    badgeBg: '#FFFFFF',
    badgeBorder: '#00BDAE',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="#00BDAE">
      <path d="M377.3 112.5l-71.1 71.1c-13.8 13.8-36.2 13.8-50 0l-71.1-71.1c-22.1-22.1-57.9-22.1-80 0l-45.3 45.3c-22.1 22.1-22.1 57.9 0 80l71.1 71.1c13.8 13.8 13.8 36.2 0 50l-71.1 71.1c-22.1 22.1-22.1 57.9 0 80l45.3 45.3c22.1 22.1 57.9 22.1 80 0l71.1-71.1c13.8-13.8 36.2-13.8 50 0l71.1 71.1c22.1 22.1 57.9 22.1 80 0l45.3-45.3c22.1-22.1 22.1-57.9 0-80l-71.1-71.1c-13.8-13.8-13.8-36.2 0-50l71.1-71.1c22.1-22.1 22.1-57.9 0-80l-45.3-45.3c-22.1-22.1-57.9-22.1-80 0z"/>
    </svg>`,
  },
  spotify: {
    darkColor: '#117A37', // Spotify Dark Green (High Contrast for Scanning)
    lightColor: '#FFFFFF',
    badgeBg: '#FFFFFF',
    badgeBorder: '#1DB954',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1DB954">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.5 17.3c-.2.3-.6.4-.9.2-2.5-1.5-5.7-1.9-9.5-1-.3.1-.7-.1-.8-.4-.1-.3.1-.7.4-.8 4.1-1 7.7-.5 10.6 1.2.3.2.4.6.2.8zm1.5-3.3c-.3.4-.8.5-1.2.3-2.9-1.8-7.3-2.3-10.7-1.3-.4.1-.9-.1-1-.5-.1-.4.1-.9.5-1 3.9-1.2 8.8-.6 12.1 1.4.4.2.5.7.3 1.1zm.1-3.5C15.4 8.3 9.4 8.1 5.9 9.2c-.6.2-1.2-.2-1.4-.7-.2-.6.2-1.2.7-1.4 4.1-1.2 10.7-1 14.8 1.4.5.3.7 1 .4 1.5-.3.4-1 .6-1.3.5z"/>
    </svg>`,
  },
  wifi: {
    darkColor: '#2B26A6', // Deep Indigo (High Contrast)
    lightColor: '#FFFFFF',
    badgeBg: '#FFFFFF',
    badgeBorder: '#4F46E5',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
      <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
      <line x1="12" y1="20" x2="12.01" y2="20" stroke-width="3.5"/>
    </svg>`,
  },
  charger: {
    darkColor: '#92400E', // Dark Amber/Gold (High Contrast)
    lightColor: '#FFFFFF',
    badgeBg: '#FFFFFF',
    badgeBorder: '#D97706',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#D97706">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>`,
  },
  main_app: {
    darkColor: '#035388', // Deep Cyan/Blue (High Contrast)
    lightColor: '#FFFFFF',
    badgeBg: '#FFFFFF',
    badgeBorder: '#0284C7',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#0284C7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="3" ry="3"/>
      <line x1="12" y1="18" x2="12.01" y2="18" stroke-width="3"/>
    </svg>`,
  },
};

/**
 * Generates a branded QR Code with high-contrast colored modules and a centered feature logo.
 * Uses Error Correction Level 'H' (High - up to 30% damage recovery) to guarantee 100% camera readability.
 */
export async function generateBrandedQrCode(
  payload: string,
  themeType: QrCodeThemeType
): Promise<string> {
  const theme = QR_THEMES[themeType] || QR_THEMES.pix;

  // Create an offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 600;

  // Render base QR code onto canvas with Error Correction 'H'
  await QRCode.toCanvas(canvas, payload, {
    width: 600,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: {
      dark: theme.darkColor,
      light: theme.lightColor,
    },
  });

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png');

  const canvasSize = canvas.width;
  // Center logo box size ~22% of total canvas size
  const logoBoxSize = Math.round(canvasSize * 0.22); // ~132px
  const x = Math.round((canvasSize - logoBoxSize) / 2);
  const y = Math.round((canvasSize - logoBoxSize) / 2);

  // 1. Draw rounded white background badge in the center
  ctx.fillStyle = theme.badgeBg;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, logoBoxSize, logoBoxSize, 22);
  } else {
    ctx.rect(x, y, logoBoxSize, logoBoxSize);
  }
  ctx.fill();

  // 2. Draw crisp colored border around center badge
  ctx.lineWidth = 5;
  ctx.strokeStyle = theme.badgeBorder;
  ctx.stroke();

  // 3. Draw the feature SVG Icon inside the badge
  return new Promise((resolve) => {
    const img = new Image();
    const svgBlob = new Blob([theme.iconSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const padding = Math.round(logoBoxSize * 0.18); // ~24px padding
      const iconSize = logoBoxSize - padding * 2;
      ctx.drawImage(img, x + padding, y + padding, iconSize, iconSize);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };

    img.src = url;
  });
}
