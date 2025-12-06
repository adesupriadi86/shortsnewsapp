
export const FONT_OPTIONS = [
    'Arial', 'Roboto', 'Oswald', 'Montserrat', 'Poppins', 'Lato', 'Open Sans', 'Impact', 'Courier New'
];

// REVISI: HANYA BACKGROUND WARNA CERAH (HIGH IMPACT)
// Text biasanya Hitam jika background sangat cerah, atau Putih jika background Merah/Orange terang.
export const CONTRAST_PAIRS = [
    { color: '#000000', bgColor: '#ffff00' }, // Black on Pure Yellow
    { color: '#000000', bgColor: '#00ffff' }, // Black on Cyan
    { color: '#000000', bgColor: '#39ff14' }, // Black on Neon Green
    { color: '#000000', bgColor: '#ffffff' }, // Black on White
    { color: '#ffffff', bgColor: '#ff0000' }, // White on Bright Red (Classic News)
    { color: '#000000', bgColor: '#fbbf24' }, // Black on Amber
    { color: '#000000', bgColor: '#f472b6' }, // Black on Hot Pink
    { color: '#000000', bgColor: '#a3e635' }, // Black on Lime
    { color: '#000000', bgColor: '#38bdf8' }, // Black on Sky Blue
    { color: '#ffffff', bgColor: '#f97316' }, // White on Bright Orange
    { color: '#000000', bgColor: '#e879f9' }, // Black on Magenta
    { color: '#ffffff', bgColor: '#ef4444' }, // White on Red-500
];

export interface RandomStyle {
    fontFamily: string;
    color: string;
    bgColor: string;
}

export const getRandomStyle = (): RandomStyle => {
    const randomFont = FONT_OPTIONS[Math.floor(Math.random() * FONT_OPTIONS.length)];
    const randomTheme = CONTRAST_PAIRS[Math.floor(Math.random() * CONTRAST_PAIRS.length)];
    
    return {
        fontFamily: randomFont,
        color: randomTheme.color,
        bgColor: randomTheme.bgColor
    };
};
