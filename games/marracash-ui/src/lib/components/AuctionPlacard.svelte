<script lang="ts">
    // The auction placard, centred on its origin and about 108 by 30 board units: drawn large in
    // the auction notice and small on the auctioned stall. The action panel's parchment in a brass
    // double frame, pointed at the ends like the player aid's plaques, with a star at each point and
    // the aid's teal for the gavel and lettering, so it stands out on a stall of any colour.
    import { PanelPalette } from '$lib/utils/playerPanel.js'

    const Outline = '#2a190e'
    const Lettering = PanelPalette.tileLight

    function notched(halfWidth: number, halfHeight: number, notch: number): string {
        return `M ${-halfWidth} 0 L ${-halfWidth + notch} ${-halfHeight} H ${halfWidth - notch} L ${halfWidth} 0 L ${halfWidth - notch} ${halfHeight} H ${-halfWidth + notch} Z`
    }

    // A four-pointed star, as the aid's headings use.
    function star(x: number, reach: number): string {
        const waist = reach * 0.18
        return `M ${x} ${-reach} Q ${x + waist} ${-waist} ${x + reach} 0 Q ${x + waist} ${waist} ${x} ${reach} Q ${x - waist} ${waist} ${x - reach} 0 Q ${x - waist} ${-waist} ${x} ${-reach} Z`
    }
</script>

<defs>
    <linearGradient id="marracash-placard-scroll" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color={PanelPalette.scrollLight}></stop>
        <stop offset="1" stop-color={PanelPalette.scrollDeep}></stop>
    </linearGradient>
</defs>
<path d={notched(54, 15, 10)} fill={PanelPalette.trim} stroke={Outline} stroke-width="1"></path>
<path d={notched(51.5, 12.5, 9)} fill="url(#marracash-placard-scroll)"></path>
<path
    d={notched(48.5, 9.5, 7.5)}
    fill="none"
    stroke={PanelPalette.trim}
    stroke-opacity="0.6"
    stroke-width="0.9"
></path>
<path d={star(-44.5, 3)} fill={PanelPalette.trim}></path>
<path d={star(44.5, 3)} fill={PanelPalette.trim}></path>
<!-- A gavel: head and handle. -->
<g transform="translate(-31 -1) rotate(-35)" fill={Lettering}>
    <rect x="-6" y="-4" width="12" height="7" rx="1.5"></rect>
    <rect x="-1" y="2.5" width="2.4" height="10" rx="1"></rect>
</g>
<text
    x="8.5"
    y="3.8"
    text-anchor="middle"
    font-family="'MarraCash El Messiri', Georgia, serif"
    font-size="11.5"
    font-weight="700"
    letter-spacing="0.8"
    fill={Lettering}>AUCTION</text
>
