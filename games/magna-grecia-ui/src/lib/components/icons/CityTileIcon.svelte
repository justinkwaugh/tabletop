<script lang="ts">
    import { darken, lighten } from '$lib/utils/colorMix.js'

    let { size = 24, color = '#c0673f' }: { size?: number; color?: string } = $props()

    const ground = $derived(lighten(color, 0.08))
    const edge = $derived(darken(color, 0.5))
    const roof = $derived(darken(color, 0.4))
</script>

<svg width={size} height={size} viewBox="-12 -12 24 24" aria-hidden="true">
    <polygon
        points="0,-11 9.5,-5.5 9.5,5.5 0,11 -9.5,5.5 -9.5,-5.5"
        fill={ground}
        stroke={edge}
        stroke-width="1.3"
    ></polygon>
    <rect x="-7.6" y="3" width="4" height="3.4" fill={color} stroke={edge} stroke-width="0.5"
    ></rect>
    <rect x="-8" y="2" width="4.8" height="1.6" fill={roof}></rect>
    <rect x="3.6" y="3" width="4" height="3.4" fill={color} stroke={edge} stroke-width="0.5"
    ></rect>
    <rect x="3.2" y="2" width="4.8" height="1.6" fill={roof}></rect>
    <rect x="-3.6" y="-2.5" width="7.2" height="6" fill="#fbf8f1" stroke="#6d6457" stroke-width="0.5"
    ></rect>
    <path d="M -1.6 -2 V 3 M 0 -2 V 3 M 1.6 -2 V 3" stroke="#b3aa99" stroke-width="0.6"></path>
    <path d="M -4.6 -2.5 L 0 -6.2 L 4.6 -2.5 Z" fill={color} stroke={edge} stroke-width="0.5"
    ></path>
</svg>
