<script lang="ts" module>
    import { HEX } from '$lib/utils/boardGeometry.js'
    import { mixColor } from '$lib/utils/colorMix.js'

    // The precinct and temple are marble; the favoured player's colour is on the temple's dome and
    // steps, on the precinct's inner shadow, and on the teardrop's tail, which runs out from the
    // precinct to the road.
    const MARBLE = '#fbf8f1'
    const MARBLE_TEMPLE = '#8a7f68'
    const LIGHT = '#fffaf0'
    const DARK = '#1d1a17'

    // The base colour of the temple's dome and steps and how deep it is laid on (1 when favoured: a
    // strong player colour, 0 when not: the marble temple's own tints), and the colour of the tail
    // and the precinct's inner shadow.
    export type OracleLook = { roof: string; depth: number; tail: string }

    export function oracleLook(attentionColor?: string): OracleLook {
        return attentionColor
            ? { roof: attentionColor, depth: 1, tail: attentionColor }
            : { roof: MARBLE_TEMPLE, depth: 0, tail: MARBLE }
    }

    export function blendLooks(from: OracleLook, to: OracleLook, amount: number): OracleLook {
        return {
            roof: mixColor(from.roof, to.roof, amount),
            depth: from.depth + (to.depth - from.depth) * amount,
            tail: mixColor(from.tail, to.tail, amount)
        }
    }

    // A tone is "<marble|temple|roof|tail>:<light|dark>:<amount>"; roof tones deepen with the look.
    export function oracleTone(look: OracleLook, tone: string): string {
        const [of, toward, value] = tone.split(':')
        const target = toward === 'dark' ? DARK : LIGHT
        const amount = Number(value)
        switch (of) {
            case 'marble':
                return mixColor(MARBLE, target, amount)
            case 'temple':
                return mixColor(MARBLE_TEMPLE, target, amount)
            case 'tail':
                return mixColor(look.tail, target, amount)
            default:
                return mixColor(look.roof, target, Math.max(0, amount - 0.22 * look.depth))
        }
    }

    // The precinct points up and is turned toward the favoured city.
    export function oracleRotation(angle: number): number {
        return angle + 90
    }

    const PRECINCT = 25
    // The middle of the hex edge, where a road comes in.
    const EDGE = (HEX.xRadius + Math.hypot(HEX.xRadius / 2, HEX.yRadius * 0.75)) / 2
    // Half a road: its 12-wide band inside a 1.3 dark edge drawn on the outline.
    const ROAD_HALF = 6.65

    // The precinct's outline at `reach` 0 (a round precinct) to 1 (a teardrop whose sides run
    // tangent out to the hex edge and end as wide as the road that comes in there).
    export function oracleDrop(reach: number): { fill: string; edge: string; dashes: string } {
        const end = PRECINCT + (EDGE - PRECINCT) * reach
        const half = ROAD_HALF * reach
        const tangent = (x: number, side: -1 | 1) => {
            const at =
                Math.atan2(-end, x) + side * Math.acos(Math.min(1, PRECINCT / Math.hypot(x, end)))
            return { x: PRECINCT * Math.cos(at), y: PRECINCT * Math.sin(at) }
        }
        const left = tangent(-half, -1)
        const right = tangent(half, 1)
        // Two arcs through the bottom, so the round precinct (both tangents at the top) still draws.
        const arc = `A ${PRECINCT} ${PRECINCT} 0 0 0`
        const edge = `M ${-half} ${-end} L ${left.x} ${left.y} ${arc} 0 ${PRECINCT} ${arc} ${right.x} ${right.y} L ${half} ${-end}`
        // The road's centre dashes carry on along the tail to the precinct.
        return { fill: `${edge} Z`, edge, dashes: `M 0 ${-end} V ${-PRECINCT - 2}` }
    }
</script>

<script lang="ts">
    import { ROAD_DASHES, localHexPoints } from '$lib/utils/boardGeometry.js'

    let { angle = -90, attentionColor }: { angle?: number; attentionColor?: string } = $props()

    const plinthShape = localHexPoints(1.5)
    const trimShape = localHexPoints(6)
    const ROAD_EDGE = '#2a1a0a'
    const TEMPLE_INK = '#3a2c1c'
    const COLUMNS = [-10.5, -3.5, 3.5, 10.5]
    const uid = $props.id()

    const rotation = $derived(oracleRotation(angle))
    const look = $derived(oracleLook(attentionColor))
    const drop = $derived(oracleDrop(attentionColor ? 1 : 0))
    const tone = (spec: string) => oracleTone(look, spec)
</script>

<g>
    <polygon
        points={plinthShape}
        fill="#f3e7c2"
        stroke="#bd9b52"
        stroke-width="1.6"
        stroke-linejoin="round"
    ></polygon>
    <polygon
        points={trimShape}
        fill="none"
        stroke="#d4bb85"
        stroke-width="1.2"
        stroke-dasharray="4 3"
        stroke-linejoin="round"
    ></polygon>
    <!-- The precinct, drawn like a city field; favoured, a coloured tail runs out to the road. -->
    <g data-part="turn" transform="rotate({rotation})">
        <path data-part="drop" data-tone="tail:light:0" d={drop.fill} fill={tone('tail:light:0')}
        ></path>
        <path
            data-part="drop-dashes"
            d={drop.dashes}
            opacity={attentionColor ? 1 : 0}
            stroke="rgba(255, 244, 220, 0.55)"
            stroke-width="2.2"
            stroke-dasharray={ROAD_DASHES.dasharray}
            stroke-dashoffset={ROAD_DASHES.dashoffset}
            stroke-linecap="round"
        ></path>
        <path
            data-part="drop-edge"
            d={drop.edge}
            fill="none"
            stroke={ROAD_EDGE}
            stroke-width="1.3"
            stroke-linejoin="round"
        ></path>
        <!-- The marble precinct sits over the tail's root. -->
        <clipPath id="mg-oracle-round-{uid}"><circle r="25"></circle></clipPath>
        <circle r="25" fill={tone('marble:light:0')}></circle>
        <circle
            r="25"
            fill="none"
            data-tone="tail:dark:0.22"
            data-tone-attr="stroke"
            stroke={tone('tail:dark:0.22')}
            stroke-width="8"
            clip-path="url(#mg-oracle-round-{uid})"
        ></circle>
        <circle r="25" fill="none" stroke={ROAD_EDGE} stroke-width="1.3"></circle>
    </g>
    <!-- A round temple (tholos) in the city temple's manner: tints, no ink. -->
    <!-- A fine ink line around each part keeps the temple crisp on every colour, yellow too. -->
    <g
        transform="translate(0 2) scale(0.88)"
        stroke={TEMPLE_INK}
        stroke-width="0.8"
        stroke-linejoin="round"
    >
        <ellipse cx="1" cy="13" rx="18" ry="3.6" fill={tone('marble:dark:0.11')} stroke="none"
        ></ellipse>
        <rect
            x="-17"
            y="9.5"
            width="34"
            height="3"
            rx="0.4"
            data-tone="roof:light:0.42"
            fill={tone('roof:light:0.42')}
        ></rect>
        <rect
            x="-15.5"
            y="7"
            width="31"
            height="2.8"
            rx="0.4"
            data-tone="roof:light:0.52"
            fill={tone('roof:light:0.52')}
        ></rect>
        {#each COLUMNS as x (x)}
            <rect x={x - 1.4} y="-6.4" width="2.8" height="13.4" fill={tone('temple:light:0.62')}
            ></rect>
            <rect
                x={x + 0.4}
                y="-6.4"
                width="1"
                height="13.4"
                fill={tone('temple:light:0.45')}
                stroke="none"
            ></rect>
        {/each}
        <rect x="-14" y="-9.8" width="28" height="3.6" fill={tone('temple:light:0.58')}></rect>
        <path
            d="M -15 -9.8 Q -13.5 -21.5 0 -23 Q 13.5 -21.5 15 -9.8 Z"
            data-tone="roof:light:0.3"
            fill={tone('roof:light:0.3')}
        ></path>
        <path
            d="M -9.5 -10.8 Q -8.5 -18.6 0 -19.8 Q 8.5 -18.6 9.5 -10.8 Z"
            data-tone="roof:light:0.5"
            fill={tone('roof:light:0.5')}
            stroke="none"
        ></path>
    </g>
</g>
