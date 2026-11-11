<script lang="ts">
    import type { Character } from '@tabletop/feudum'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import {
        DropPath,
        GuildIconPaths,
        PawnBodyPath,
        PawnBox,
        PawnMedallion
    } from '$lib/utils/pieceShapes.js'

    /**
     * R-4.5.1 A pawn takes a seat colour, so it is always drawn: the figure in the seat's fill from
     * the session (S71), its character on a parchment medallion, the seat's initial on its base.
     * R-4.8.2 A drunk pawn tilts and carries a sulfur drop. A pawn in supply has no character yet
     * (R-3.6), so its medallion is bare.
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

    let label = $derived(`${paint.initial} ${character ?? 'pawn'}${drunk ? ', drunk' : ''}`)
    let box = $derived(`-4 0 ${PawnBox.width + 8} ${PawnBox.height}`)
    let iconSize = PawnMedallion.r * 1.6
</script>

<svg
    {x}
    {y}
    width={(size * (PawnBox.width + 8)) / PawnBox.height}
    height={size}
    viewBox={box}
    role="img"
    aria-label={label}
>
    <title>{label}</title>
    <g transform={drunk ? `rotate(9 ${PawnBox.width / 2} ${PawnBox.height})` : undefined}>
        <path d={PawnBodyPath} fill={paint.fill} stroke={paint.edge} stroke-width="1"></path>
        <circle
            cx={PawnMedallion.x}
            cy={PawnMedallion.y}
            r={PawnMedallion.r}
            fill="var(--feudum-parchment)"
            stroke="var(--feudum-ink)"
            stroke-width="0.5"
        ></circle>
        {#if character}
            <path
                d={GuildIconPaths[character]}
                transform="translate({PawnMedallion.x - iconSize / 2} {PawnMedallion.y -
                    iconSize / 2}) scale({iconSize / 24})"
                fill="var(--feudum-ink)"
                fill-rule="evenodd"
            ></path>
        {/if}
        <text
            x={PawnBox.width / 2}
            y={PawnBox.height - 3}
            text-anchor="middle"
            font-size="7"
            font-weight="700"
            fill={paint.ink}>{paint.initial}</text
        >
    </g>
    {#if drunk}
        <path
            d={DropPath}
            transform="translate(27 2) scale(0.42)"
            fill="var(--feudum-good-sulfur)"
            stroke="var(--feudum-map-ink)"
            stroke-width="1.5"
        ></path>
    {/if}
</svg>
