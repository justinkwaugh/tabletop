import { PanelPalette } from '$lib/utils/playerPanel.js'

const LatticeOpacity = 0.13

const ZelligeLatticeTile = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
<g fill="none" stroke="${PanelPalette.brass}" stroke-opacity="${LatticeOpacity}" stroke-width="1.2">
<rect x="16" y="16" width="24" height="24"/>
<rect x="16" y="16" width="24" height="24" transform="rotate(45 28 28)"/>
<path d="M0 0 L11 11 M56 0 L45 11 M0 56 L11 45 M56 56 L45 45"/>
<circle cx="28" cy="28" r="4"/>
</g>
</svg>`

export const NightZelligeBackground = [
    `url("data:image/svg+xml,${encodeURIComponent(ZelligeLatticeTile)}")`,
    'radial-gradient(ellipse 80% 70% at 55% 40%, #1d2550 0%, #141a3a 60%, #0d1128 100%)'
].join(', ')
