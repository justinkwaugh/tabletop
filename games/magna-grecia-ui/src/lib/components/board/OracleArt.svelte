<script lang="ts" module>
    import { HEX } from '$lib/utils/boardGeometry.js'
    import { mixColor } from '$lib/utils/colorMix.js'

    // How an oracle is coloured: its precinct, the base its temple is tinted from, and how far the
    // temple's tints are lifted toward white (1 when favoured, so it reads on any player colour).
    export type OracleLook = { field: string; temple: string; lift: number }

    const MARBLE: OracleLook = { field: '#fbf8f1', temple: '#8a7f68', lift: 0 }
    const LIGHT = '#fffaf0'
    const DARK = '#1d1a17'

    export function oracleLook(attentionColor?: string): OracleLook {
        return attentionColor ? { field: attentionColor, temple: attentionColor, lift: 1 } : MARBLE
    }

    export function blendLooks(from: OracleLook, to: OracleLook, amount: number): OracleLook {
        return {
            field: mixColor(from.field, to.field, amount),
            temple: mixColor(from.temple, to.temple, amount),
            lift: from.lift + (to.lift - from.lift) * amount
        }
    }

    // A tone is "<field|temple>:<light|dark>:<amount>"; temple tones are lifted with the look.
    export function oracleTone(look: OracleLook, tone: string): string {
        const [of, toward, value] = tone.split(':')
        const amount = Number(value)
        if (of === 'field') {
            return mixColor(look.field, toward === 'dark' ? DARK : LIGHT, amount)
        }
        const lifted = amount + look.lift * (0.38 - 0.25 * amount)
        return mixColor(look.temple, toward === 'dark' ? DARK : LIGHT, lifted)
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
        return { fill: `${edge} Z`, edge, dashes: `M 0 ${-end} V ${-PRECINCT - 2}` }
    }
</script>

<script lang="ts">
    import { ROAD_DASHES, localHexPoints } from '$lib/utils/boardGeometry.js'

    let { angle = -90, attentionColor }: { angle?: number; attentionColor?: string } = $props()

    const plinthShape = localHexPoints(1.5)
    const trimShape = localHexPoints(6)
    const ROAD_EDGE = '#2a1a0a'
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
        fill="#ecdcae"
        stroke="#b8954a"
        stroke-width="1.6"
        stroke-linejoin="round"
    ></polygon>
    <polygon
        points={trimShape}
        fill="none"
        stroke="#cdb27a"
        stroke-width="1.2"
        stroke-dasharray="4 3"
        stroke-linejoin="round"
    ></polygon>
    <!-- The precinct, drawn like a city field; favoured, it runs out to meet the road. -->
    <g data-part="turn" transform="rotate({rotation})" filter="url(#mg-tile-shadow)">
        <clipPath id="mg-oracle-drop-{uid}">
            <path data-part="drop" d={drop.fill}></path>
        </clipPath>
        <clipPath id="mg-oracle-round-{uid}"><circle r="25"></circle></clipPath>
        <path data-part="drop" data-tone="field:light:0" d={drop.fill} fill={tone('field:light:0')}
        ></path>
        <g clip-path="url(#mg-oracle-drop-{uid})">
            <circle
                r="25"
                fill="none"
                data-tone="field:dark:0.22"
                data-tone-attr="stroke"
                stroke={tone('field:dark:0.22')}
                stroke-width="8"
                clip-path="url(#mg-oracle-round-{uid})"
            ></circle>
        </g>
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
    </g>
    <!-- A round temple (tholos) in the city temple's manner: tints, no ink. -->
    <g transform="translate(0 2) scale(0.88)">
        <ellipse
            cx="1"
            cy="13"
            rx="18"
            ry="3.6"
            data-tone="field:dark:0.11"
            fill={tone('field:dark:0.11')}
        ></ellipse>
        <rect
            x="-17"
            y="9.5"
            width="34"
            height="3"
            rx="0.4"
            data-tone="temple:light:0.42"
            fill={tone('temple:light:0.42')}
        ></rect>
        <rect
            x="-15.5"
            y="7"
            width="31"
            height="2.8"
            rx="0.4"
            data-tone="temple:light:0.52"
            fill={tone('temple:light:0.52')}
        ></rect>
        {#each COLUMNS as x (x)}
            <rect
                x={x - 1.4}
                y="-6.4"
                width="2.8"
                height="13.4"
                data-tone="temple:light:0.62"
                fill={tone('temple:light:0.62')}
            ></rect>
            <rect
                x={x + 0.4}
                y="-6.4"
                width="1"
                height="13.4"
                data-tone="temple:light:0.45"
                fill={tone('temple:light:0.45')}
            ></rect>
        {/each}
        <rect
            x="-14"
            y="-9.8"
            width="28"
            height="3.6"
            data-tone="temple:light:0.58"
            fill={tone('temple:light:0.58')}
        ></rect>
        <path
            d="M -15 -9.8 Q -13.5 -21.5 0 -23 Q 13.5 -21.5 15 -9.8 Z"
            data-tone="temple:light:0.3"
            fill={tone('temple:light:0.3')}
        ></path>
        <path
            d="M -9.5 -10.8 Q -8.5 -18.6 0 -19.8 Q 8.5 -18.6 9.5 -10.8 Z"
            data-tone="temple:light:0.5"
            fill={tone('temple:light:0.5')}
        ></path>
        <circle
            cx="0"
            cy="-24.3"
            r="1.6"
            data-tone="temple:light:0.5"
            fill={tone('temple:light:0.5')}
        ></circle>
    </g>
</g>
