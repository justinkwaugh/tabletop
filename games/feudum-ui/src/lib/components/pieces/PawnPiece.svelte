<script lang="ts">
    import type { Character } from '@tabletop/feudum'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import { DropPath, GuildIconPaths, PawnCube } from '$lib/utils/pieceShapes.js'

    /**
     * R-4.5.1 A pawn takes a seat colour, so it is always drawn: the wooden cube in the seat's fill
     * from the session (S71), seen a little from above, with its character printed pale on the top
     * face with a dark outline, as on the printed cubes. R-4.8.2 A drunk pawn tilts and carries a
     * sulfur drop. A pawn in supply has no character yet (R-3.6), so its top face is bare.
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

    /** Room round the cube for its tilt and its drop. */
    const Margin = 2
    const { box, side, top, shine, corner, face } = PawnCube

    let label = $derived(`${paint.initial} ${character ?? 'pawn'}${drunk ? ', drunk' : ''}`)
</script>

<svg
    {x}
    {y}
    width={size}
    height={size}
    viewBox="{-Margin} {-Margin} {box + 2 * Margin} {box + 2 * Margin}"
    role="img"
    aria-label={label}
    data-pawn-cube
>
    <title>{label}</title>
    <g transform={drunk ? `rotate(9 ${box / 2} ${box})` : undefined}>
        <rect {...side} rx={corner} fill={paint.fill} data-cube-side></rect>
        <rect {...side} rx={corner} fill="var(--feudum-halo)" fill-opacity="0.32"></rect>
        <rect
            {...top}
            rx={corner}
            fill={paint.fill}
            stroke={paint.edge}
            stroke-width="1"
            data-cube-top
        ></rect>
        <rect {...shine} rx="2" fill="var(--feudum-text)" fill-opacity="0.18"></rect>
        <rect {...side} rx={corner} fill="none" stroke={paint.edge} stroke-width="1"></rect>
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
            transform="translate(23 -2) scale(0.42)"
            fill="var(--feudum-good-sulfur)"
            stroke="var(--feudum-map-ink)"
            stroke-width="1.5"
        ></path>
    {/if}
</svg>
