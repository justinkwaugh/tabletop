<script lang="ts">
    import { mixColor } from '$lib/utils/colorMix.js'

    let { size = 24, color = '#c0673f' }: { size?: number; color?: string } = $props()

    const OUTLINE = '#1d1a17'
    const WHITE = '#fbf9f4'
    const band = $derived(mixColor(color, '#000000', 0.22))
    const roof = $derived(mixColor(color, '#000000', 0.38))
</script>

<svg width={size} height={size} viewBox="-12 -12 24 24" aria-hidden="true">
    <polygon
        points="0,-11 9.5,-5.5 9.5,5.5 0,11 -9.5,5.5 -9.5,-5.5"
        fill={color}
        stroke={OUTLINE}
        stroke-width="0.8"
    ></polygon>
    <polygon
        points="0,-9.4 8.1,-4.7 8.1,4.7 0,9.4 -8.1,4.7 -8.1,-4.7"
        fill="none"
        stroke={band}
        stroke-width="1.6"
    ></polygon>
    <polygon
        points="0,-9.4 8.1,-4.7 8.1,4.7 0,9.4 -8.1,4.7 -8.1,-4.7"
        fill="none"
        stroke={WHITE}
        stroke-width="0.5"
    ></polygon>
    <g stroke={OUTLINE} stroke-width="0.45" stroke-linejoin="round">
        <rect x="-5.2" y="3.4" width="10.4" height="1.8" fill={roof}></rect>
        <rect x="-4.3" y="-2.4" width="8.6" height="5.8" fill={WHITE}></rect>
        <path d="M -2.2 -1.6 V 2.6 M 0 -1.6 V 2.6 M 2.2 -1.6 V 2.6" stroke="#8f8779"></path>
        <rect x="-4.8" y="-3.7" width="9.6" height="1.3" fill={roof}></rect>
        <path d="M -5.2 -3.7 L 0 -6.7 L 5.2 -3.7 Z" fill={roof}></path>
    </g>
</svg>
