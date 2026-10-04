<script lang="ts" module>
    export type MarketState = 'active' | 'inactive' | 'sold'

    const RADIUS = { x: 9, y: 3.4 }
    // The ground line: a market rising out of the ground starts with its top here.
    export const MARKET_BASE = 9
    const TALL_TOP = -6
    const LOW_TOP = 2
    // Centre of the sold X, which scales about it.
    export const SOLD_MARK_CENTER = { x: 0, y: 3.9 }

    export function marketTop(state: MarketState): number {
        return state === 'inactive' ? LOW_TOP : TALL_TOP
    }

    export function marketBody(top: number): string {
        return `M ${-RADIUS.x} ${top} V ${MARKET_BASE} A ${RADIUS.x} ${RADIUS.y} 0 0 0 ${RADIUS.x} ${MARKET_BASE} V ${top} Z`
    }
</script>

<script lang="ts">
    import { mixColor } from '$lib/utils/colorMix.js'

    let { color, state }: { color: string; state: MarketState } = $props()

    const INK = '#1a1208'
    const SOLD_MARK = '#fffaf0'
    const X_PATH = 'M -4.95 -0.78 L 4.95 8.58 M 4.95 -0.78 L -4.95 8.58'
    const uid = $props.id()
    const gradientId = `mg-market-${uid}`

    const top = $derived(marketTop(state))
    const body = $derived(marketBody(top))
    const shade = (amount: number) => mixColor(color, '#000000', amount)
    const tint = (amount: number) => mixColor(color, '#ffffff', amount)
</script>

<defs>
    <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color={shade(0.18)}></stop>
        <stop offset="0.22" stop-color={tint(0.28)}></stop>
        <stop offset="0.5" stop-color={color}></stop>
        <stop offset="1" stop-color={shade(0.38)}></stop>
    </linearGradient>
</defs>
<path
    data-part="body"
    d={body}
    fill="url(#{gradientId})"
    stroke={INK}
    stroke-width="1.1"
    stroke-linejoin="round"
></path>
<ellipse
    data-part="top"
    cx="0"
    cy={top}
    rx={RADIUS.x}
    ry={RADIUS.y}
    fill={tint(0.16)}
    stroke={INK}
    stroke-width="1.1"
></ellipse>
<ellipse
    data-part="top"
    cx="0"
    cy={top}
    rx={RADIUS.x - 1.6}
    ry={RADIUS.y - 0.9}
    fill="none"
    stroke={tint(0.4)}
    stroke-width="0.7"
></ellipse>
<!-- Always drawn, so selling can stamp it on before the sold state arrives. -->
<g data-part="sold-mark" opacity={state === 'sold' ? 1 : 0}>
    <path d={X_PATH} stroke={INK} stroke-width="4.6" stroke-linecap="round"></path>
    <path d={X_PATH} stroke={SOLD_MARK} stroke-width="2.6" stroke-linecap="round"></path>
</g>
