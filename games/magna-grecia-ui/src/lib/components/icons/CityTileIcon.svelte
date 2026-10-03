<script lang="ts">
    import { mixColor } from '$lib/utils/colorMix.js'

    let { size = 24, color = '#c0673f' }: { size?: number; color?: string } = $props()

    const OUTLINE = '#1d1a17'
    const band = $derived(mixColor(color, '#000000', 0.22))
    const keyline = $derived(mixColor(color, '#ffffff', 0.5))
    const paving = $derived(mixColor(color, '#ffffff', 0.62))
    const joints = $derived(mixColor(color, '#000000', 0.18))
    const basin = $derived(mixColor(color, '#ffffff', 0.75))
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
        stroke={keyline}
        stroke-width="0.5"
    ></polygon>
    <rect
        x="-5"
        y="-5"
        width="10"
        height="10"
        rx="0.6"
        fill={paving}
        stroke={OUTLINE}
        stroke-width="0.5"
    ></rect>
    <path
        d="M -5 -2.5 H 5 M -5 2.5 H 5 M -2.5 -5 V 5 M 2.5 -5 V 5"
        stroke={joints}
        stroke-width="0.3"
    ></path>
    <circle r="2.7" fill={basin} stroke={OUTLINE} stroke-width="0.45"></circle>
    <circle r="1.8" fill="#4a90b8"></circle>
</svg>
