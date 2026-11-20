<script lang="ts">
    import type { Character } from '@tabletop/feudum'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import { DropPath, GuildIconPaths, PawnCube } from '$lib/utils/pieceShapes.js'

    /**
     * R-4.5.1 A pawn takes its seat's colour (S71). R-4.8.2 A drunk pawn tilts and carries a drop.
     * R-3.6 One in supply has no character. Its shadow is a shape, so a phone renders it.
     */
    let {
        paint,
        character,
        drunk = false,
        size = 44,
        x,
        y
    }: {
        paint: SeatPaint
        character?: Character
        drunk?: boolean
        size?: number
        x?: number
        y?: number
    } = $props()

    const Margin = 2
    const OutlineWidth = 5
    const ShadowDrop = 3
    const { box, front, top, side, outline, edges, face } = PawnCube

    let label = $derived(
        `${paint.owner} ${character ? `${character} ` : ''}pawn${drunk ? ', drunk' : ''}`
    )
</script>

<svg
    {x}
    {y}
    width={size}
    height={size}
    viewBox="{-Margin} {-Margin} {box + 2 * Margin} {box + 2 * Margin}"
    overflow="visible"
    role="img"
    aria-label={label}
    data-pawn-cube
>
    <title>{label}</title>
    <g transform={drunk ? `rotate(9 ${box / 2} ${front.y + front.height})` : undefined}>
        <path
            d={outline}
            transform="translate(0 {ShadowDrop})"
            fill="var(--feudum-halo)"
            fill-opacity="0.45"
            data-piece-shadow
        ></path>
        <path
            d={outline}
            fill="var(--feudum-map-ink)"
            stroke="var(--feudum-map-ink)"
            stroke-width={OutlineWidth}
            stroke-linejoin="round"
            data-piece-outline
        ></path>
        <path d={top} fill={paint.fill} data-cube-top></path>
        <path d={top} fill="var(--feudum-text)" fill-opacity="0.2"></path>
        <path d={side} fill={paint.fill} data-cube-side></path>
        <path d={side} fill="var(--feudum-halo)" fill-opacity="0.36"></path>
        <rect {...front} fill={paint.fill} data-cube-front></rect>
        <path
            d="{outline} {edges}"
            fill="none"
            stroke={paint.edge}
            stroke-width="1"
            stroke-linejoin="round"
        ></path>
        {#if character}
            <path
                d={GuildIconPaths[character]}
                transform="translate({face.x} {face.y}) scale({face.size / 24})"
                fill="var(--feudum-parchment)"
                fill-rule="evenodd"
                stroke="var(--feudum-ink)"
                stroke-width="1.4"
                stroke-linejoin="round"
                paint-order="stroke"
                data-cube-face
            ></path>
        {/if}
    </g>
    {#if drunk}
        <path
            d={DropPath}
            transform="translate(27 -3) scale(0.5)"
            fill="var(--feudum-good-sulfur)"
            stroke="var(--feudum-map-ink)"
            stroke-width="1.5"
        ></path>
    {/if}
</svg>
