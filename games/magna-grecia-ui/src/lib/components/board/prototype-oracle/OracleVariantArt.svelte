<script lang="ts">
    // PROTOTYPE, throwaway: oracle styles B–F. A is the production OracleArt.
    import { localHexPoints } from '$lib/utils/boardGeometry.js'
    import { mixColor } from '$lib/utils/colorMix.js'
    import TempleArt from '../TempleArt.svelte'
    import type { OracleVariant } from './oracleVariant.svelte.js'

    let {
        variant,
        angle = -90,
        attentionColor
    }: { variant: OracleVariant; angle?: number; attentionColor?: string } = $props()

    const OUTLINE = '#11161d'
    const WHITE = '#fbf9f4'
    const STONE = '#d9ccb0'
    const uid = $props.id()
    const rotation = $derived(angle + 90)
    const accent = $derived(attentionColor ?? WHITE)
    const favoured = $derived(attentionColor !== undefined)
    const shade = (c: string, a: number) => mixColor(c, '#1d1a17', a)
    const tint = (c: string, a: number) => mixColor(c, '#fffaf0', a)
    // A disc of radius 25 drawn out to a tip 44 from its centre, pointing up.
    const plinthShape = localHexPoints(1.5)
    const trimShape = localHexPoints(6)
    // The neck runs from the precinct to the middle of the hex edge, where the road enters.
    const EDGE = 43.4
    const NECK = `M 0 ${-EDGE} V -21`
    // Teardrop: a precinct of radius 25 whose sides run tangent out to the hex edge, ending as wide
    // as a road (band 12 inside a 1.3 dark edge) so the road carries straight on into it.
    const DROP_R = 25
    const END = 6.65
    function tangentPoint(px: number, py: number, side: -1 | 1) {
        const at = Math.atan2(py, px) + side * Math.acos(DROP_R / Math.hypot(px, py))
        return { x: DROP_R * Math.cos(at), y: DROP_R * Math.sin(at) }
    }
    const left = tangentPoint(-END, -EDGE, -1)
    const right = tangentPoint(END, -EDGE, 1)
    const DROP_EDGE = `M ${-END} ${-EDGE} L ${left.x} ${left.y} A ${DROP_R} ${DROP_R} 0 1 0 ${right.x} ${right.y} L ${END} ${-EDGE}`
    const DROP = `${DROP_EDGE} Z`
    // The oracle's round temple in the city temple's manner: tints of the precinct colour, no ink.
    const stone = (c: string, a: number) => mixColor(c, '#fffaf0', a)
    // Unfavoured finishes: the precinct colour and the base its temple is tinted from.
    const MARBLE = { field: '#fbf8f1', temple: '#8a7f68' }
    const BRONZE = { field: '#6e5536', temple: '#6e5536' }
    const PIN = 'M -20.5 -14.2 L 0 -44 L 20.5 -14.2 A 25 25 0 1 1 -20.5 -14.2 Z'
</script>

{#if variant === 'B' || variant === 'C'}
    <g transform="rotate({rotation})">
        <g
            transform="translate(-0.05 -2.1)"
            stroke={OUTLINE}
            stroke-linejoin="round"
            filter="url(#mg-tile-shadow)"
        >
            <rect x="-19" y="21" width="38" height="5" rx="0.6" fill={accent} stroke-width="1.3"
            ></rect>
            <rect x="-16" y="17" width="32" height="4" rx="0.6" fill={accent} stroke-width="1.3"
            ></rect>
            {#if variant === 'B'}
                <rect x="-9" y="-13" width="18" height="30" fill={WHITE} stroke-width="1"></rect>
                <rect x="-3" y="5" width="6" height="12" fill={accent} stroke-width="0.9"></rect>
            {/if}
            <rect x="-11.25" y="-10.5" width="5.5" height="27.5" fill={WHITE} stroke-width="1.2"
            ></rect>
            <rect x="5.75" y="-10.5" width="5.5" height="27.5" fill={WHITE} stroke-width="1.2"
            ></rect>
            {#if variant === 'C'}
                <rect x="-2.75" y="-10.5" width="5.5" height="27.5" fill={WHITE} stroke-width="1.2"
                ></rect>
            {/if}
            <rect x="-12.75" y="-13" width="8.5" height="2.5" rx="0.8" fill={WHITE} stroke-width="1"
            ></rect>
            <rect x="4.25" y="-13" width="8.5" height="2.5" rx="0.8" fill={WHITE} stroke-width="1"
            ></rect>
            <rect
                x="-15"
                y="-17.5"
                width="30"
                height="4.5"
                rx="0.6"
                fill={accent}
                stroke-width="1.3"
            ></rect>
            <polygon points="-15,-17.5 0,-28.5 15,-17.5" fill={accent} stroke-width="1.8"></polygon>
        </g>
    </g>
{:else if variant === 'D'}
    <!-- Sanctuary: a precinct drawn like a city field; favoured, it becomes a pin whose tip points
         at the city, with the city-style temple upright on it. -->
    <g filter="url(#mg-tile-shadow)">
        {#if favoured}
            <g transform="rotate({rotation})">
                <clipPath id="pin-{uid}"><path d={PIN}></path></clipPath>
                <path d={PIN} fill={accent}></path>
                <path
                    d={PIN}
                    fill="none"
                    stroke={shade(accent, 0.22)}
                    stroke-width="6"
                    clip-path="url(#pin-{uid})"
                ></path>
                <path
                    d={PIN}
                    fill="none"
                    stroke={OUTLINE}
                    stroke-width="1.2"
                    stroke-linejoin="round"
                ></path>
            </g>
        {:else}
            <circle r="25" fill="#e9dfc6" stroke={OUTLINE} stroke-width="1.2"></circle>
            <circle r="22.6" fill="none" stroke="#cbbd9c" stroke-width="3"></circle>
        {/if}
        <g transform="translate(0 -1) scale(0.9)">
            <TempleArt color={favoured ? accent : '#bfb08c'} />
        </g>
    </g>
{:else if variant === 'E'}
    <!-- Tholos: a round temple seen from above; its roof's gnomon points at the favoured city. -->
    <defs>
        <radialGradient id="tholos-roof-{uid}" cx="0.4" cy="0.38" r="0.7">
            <stop offset="0" stop-color={tint(accent, favoured ? 0.38 : 0)}></stop>
            <stop offset="1" stop-color={favoured ? shade(accent, 0.18) : '#d9d2c2'}></stop>
        </radialGradient>
    </defs>
    <g filter="url(#mg-tile-shadow)">
        <circle r="31" fill="#e7d8ad" stroke="#b8954a" stroke-width="1.4"></circle>
        <circle r="27.5" fill="#efe4c4" stroke="#c9ad6c" stroke-width="1"></circle>
        {#each Array.from({ length: 14 }, (_, i) => i) as i (i)}
            {@const a = (i / 14) * Math.PI * 2}
            <circle
                cx={Math.cos(a) * 22.5}
                cy={Math.sin(a) * 22.5}
                r="2.6"
                fill={WHITE}
                stroke={OUTLINE}
                stroke-width="0.9"
            ></circle>
        {/each}
        <circle r="17" fill="url(#tholos-roof-{uid})" stroke={OUTLINE} stroke-width="1.2"></circle>
        <circle
            r="10.5"
            fill="none"
            stroke={favoured ? shade(accent, 0.3) : '#bdb3a0'}
            stroke-width="0.8"
        ></circle>
        {#if favoured}
            <g transform="rotate({rotation})">
                <polygon
                    points="-5,2 0,-30 5,2"
                    fill={shade(accent, 0.35)}
                    stroke={OUTLINE}
                    stroke-width="1"
                    stroke-linejoin="round"
                ></polygon>
            </g>
        {/if}
        <circle
            r="3.2"
            fill={favoured ? tint(accent, 0.5) : WHITE}
            stroke={OUTLINE}
            stroke-width="0.9"
        ></circle>
    </g>
{:else if variant === 'F'}
    <!-- Sanctuary 2: the oracle's own tile, a precinct in the favoured colour whose neck carries the
         road in from the hex edge, and the oracle's round temple standing upright. -->
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
    {#if favoured}
        <g transform="rotate({rotation})">
            <path d={NECK} stroke="#4d3016" stroke-width="18" opacity="0.25"></path>
            <path d={NECK} stroke="#2a1a0a" stroke-width="14.6"></path>
        </g>
    {/if}
    <g filter="url(#mg-tile-shadow)">
        <clipPath id="precinct-{uid}"><circle r="25"></circle></clipPath>
        <circle r="25" fill={favoured ? accent : '#e9dfc6'}></circle>
        <circle
            r="25"
            fill="none"
            stroke={favoured ? shade(accent, 0.22) : '#cbbd9c'}
            stroke-width="6"
            clip-path="url(#precinct-{uid})"
        ></circle>
        <circle r="25" fill="none" stroke={OUTLINE} stroke-width="1.2"></circle>
    </g>
    {#if favoured}
        <g transform="rotate({rotation})">
            <path d={NECK} stroke={accent} stroke-width="12"></path>
            <path
                d="M 0 {-EDGE} V -27"
                stroke="rgba(255, 244, 220, 0.55)"
                stroke-width="2.2"
                stroke-dasharray="2 5"
                stroke-linecap="round"
            ></path>
        </g>
    {/if}
    <!-- A round temple (tholos) in elevation: steps, four columns, a domed roof and finial. -->
    <g
        transform="translate(0 3)"
        stroke={OUTLINE}
        stroke-linejoin="round"
        filter="url(#mg-tile-shadow)"
    >
        <rect x="-11" y="-7" width="22" height="15" fill="#e4ddcd" stroke-width="0.8"></rect>
        {#each [-10.5, -3.5, 3.5, 10.5] as x (x)}
            <rect x={x - 1.8} y="-7" width="3.6" height="15" fill={WHITE} stroke-width="0.9"></rect>
        {/each}
        <rect x="-14.5" y="7.5" width="29" height="3.4" rx="0.5" fill={WHITE} stroke-width="1"
        ></rect>
        <rect x="-17" y="10.9" width="34" height="3.8" rx="0.5" fill={WHITE} stroke-width="1.1"
        ></rect>
        <rect x="-14" y="-10.4" width="28" height="3.6" rx="0.5" fill={WHITE} stroke-width="1"
        ></rect>
        <path
            d="M -14.5 -10.4 Q -13 -22 0 -23.5 Q 13 -22 14.5 -10.4 Z"
            fill={favoured ? tint(accent, 0.3) : WHITE}
            stroke-width="1.3"
        ></path>
        <circle
            cx="0"
            cy="-25.2"
            r="1.8"
            fill={favoured ? tint(accent, 0.3) : WHITE}
            stroke-width="0.9"
        ></circle>
    </g>
{:else if variant === 'G' || variant === 'H' || variant === 'I'}
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
    {@const neutral = variant === 'H' ? BRONZE : MARBLE}
    {@const lift = variant === 'I' ? (a: number) => 0.38 + a * 0.75 : (a: number) => a}
    {@const field = favoured ? accent : neutral.field}
    {@const templeBase = favoured ? accent : neutral.temple}
    <g filter="url(#mg-tile-shadow)">
        {#if favoured}
            <g transform="rotate({rotation})">
                <clipPath id="drop-{uid}"><path d={DROP}></path></clipPath>
                <clipPath id="drop-round-{uid}"><circle r={DROP_R}></circle></clipPath>
                <path d={DROP} fill={field}></path>
                <g clip-path="url(#drop-{uid})">
                    <circle
                        r={DROP_R}
                        fill="none"
                        stroke={shade(field, 0.22)}
                        stroke-width="8"
                        clip-path="url(#drop-round-{uid})"
                    ></circle>
                </g>
                <path
                    d="M 0 {-EDGE} V -27"
                    stroke="rgba(255, 244, 220, 0.55)"
                    stroke-width="2.2"
                    stroke-dasharray="2 5"
                    stroke-linecap="round"
                ></path>
                <path
                    d={DROP_EDGE}
                    fill="none"
                    stroke="#2a1a0a"
                    stroke-width="1.3"
                    stroke-linejoin="round"
                ></path>
            </g>
        {:else}
            <clipPath id="drop-round-{uid}"><circle r={DROP_R}></circle></clipPath>
            <circle r={DROP_R} fill={field}></circle>
            <circle
                r={DROP_R}
                fill="none"
                stroke={shade(field, 0.22)}
                stroke-width="8"
                clip-path="url(#drop-round-{uid})"
            ></circle>
            <circle r={DROP_R} fill="none" stroke="#2a1a0a" stroke-width="1.3"></circle>
        {/if}
    </g>
    <g transform="translate(0 2) scale(0.88)">
        <ellipse cx="1" cy="13" rx="18" ry="3.6" fill={shade(field, 0.11)}></ellipse>
        <rect x="-17" y="9.5" width="34" height="3" rx="0.4" fill={stone(templeBase, lift(0.42))}
        ></rect>
        <rect x="-15.5" y="7" width="31" height="2.8" rx="0.4" fill={stone(templeBase, lift(0.52))}
        ></rect>
        {#each [-10.5, -3.5, 3.5, 10.5] as x (x)}
            <rect
                x={x - 1.4}
                y="-6.4"
                width="2.8"
                height="13.4"
                fill={stone(templeBase, lift(0.62))}
            ></rect>
            <rect x={x + 0.4} y="-6.4" width="1" height="13.4" fill={stone(templeBase, lift(0.45))}
            ></rect>
        {/each}
        <rect x="-14" y="-9.8" width="28" height="3.6" fill={stone(templeBase, lift(0.58))}></rect>
        <path
            d="M -15 -9.8 Q -13.5 -21.5 0 -23 Q 13.5 -21.5 15 -9.8 Z"
            fill={stone(templeBase, lift(0.3))}
        ></path>
        <path
            d="M -9.5 -10.8 Q -8.5 -18.6 0 -19.8 Q 8.5 -18.6 9.5 -10.8 Z"
            fill={stone(templeBase, lift(0.5))}
        ></path>
        <circle cx="0" cy="-24.3" r="1.6" fill={stone(templeBase, lift(0.5))}></circle>
    </g>
{/if}
