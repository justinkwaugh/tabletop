<script lang="ts" module>
    export type MarketState = 'active' | 'inactive' | 'sold'
</script>

<script lang="ts">
    import { mixColor } from '$lib/utils/colorMix.js'

    let { color, state }: { color: string; state: MarketState } = $props()

    const INK = '#1a1208'
    const SOLD_WASH = '#bdb8b0'
    const RADIUS = { x: 9, y: 3.4 }
    const BASE = 9
    const TALL_TOP = -6
    const LOW_TOP = 2
    const X_PATH = 'M -4.95 -0.8 L 4.95 8.6 M 4.95 -0.8 L -4.95 8.6'
    const uid = $props.id()
    const gradientId = `mg-market-${uid}`

    const sold = $derived(state === 'sold')
    const top = $derived(state === 'inactive' ? LOW_TOP : TALL_TOP)
    const body = $derived(
        `M ${-RADIUS.x} ${top} V ${BASE} A ${RADIUS.x} ${RADIUS.y} 0 0 0 ${RADIUS.x} ${BASE} V ${top} Z`
    )
    const tone = (hex: string) => (sold ? mixColor(hex, SOLD_WASH, 0.45) : hex)
    const shade = (amount: number) => tone(mixColor(color, '#000000', amount))
    const tint = (amount: number) => tone(mixColor(color, '#ffffff', amount))
</script>

<defs>
    <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color={shade(0.18)}></stop>
        <stop offset="0.22" stop-color={tint(0.28)}></stop>
        <stop offset="0.5" stop-color={tone(color)}></stop>
        <stop offset="1" stop-color={shade(0.38)}></stop>
    </linearGradient>
</defs>
<path d={body} fill="url(#{gradientId})" stroke={INK} stroke-width="1.1" stroke-linejoin="round"
></path>
<ellipse
    cx="0"
    cy={top}
    rx={RADIUS.x}
    ry={RADIUS.y}
    fill={tint(0.16)}
    stroke={INK}
    stroke-width="1.1"
></ellipse>
<ellipse
    cx="0"
    cy={top}
    rx={RADIUS.x - 1.6}
    ry={RADIUS.y - 0.9}
    fill="none"
    stroke={tint(0.4)}
    stroke-width="0.7"
></ellipse>
{#if sold}
    <path d={X_PATH} stroke={INK} stroke-width="3.9" stroke-linecap="round"></path>
    <path d={X_PATH} stroke={color} stroke-width="2.3" stroke-linecap="round"></path>
{/if}
