<script lang="ts">
    import {
        KnightMonsterIcons,
        KnightSections,
        type HydratedFeudumGameState
    } from '@tabletop/feudum'
    import type { Color } from '@tabletop/common'
    import BoardPiece from '$lib/components/map/BoardPiece.svelte'
    import MonsterToken from '$lib/components/pieces/MonsterToken.svelte'
    import SeatToken from '$lib/components/pieces/SeatToken.svelte'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import {
        GuildSizes,
        KnightCell,
        KnightSectionHeaderY,
        MonsterBox,
        guildSlot,
        knightCell,
        knightRowLabel,
        knightSectionMiddle
    } from '$lib/utils/boardGeometry.js'
    import { BarrelPath } from '$lib/utils/trackShape.js'

    /**
     * R-1.3 One row per colour in use, each of three barrel sections; a dummy row wears its colour with
     * no seat's initial (R-1.4-H1). R-4.2.4 Each monster's icon carries the marker of whoever controls it.
     */
    let {
        state,
        paintOf,
        colourPaintOf
    }: {
        state: HydratedFeudumGameState
        paintOf: (playerId: string) => SeatPaint
        colourPaintOf: (colour: Color) => SeatPaint
    } = $props()

    const Columns = KnightSections.flatMap(({ firstColumn, lastColumn }) =>
        Array.from({ length: lastColumn - firstColumn + 1 }, (_, index) => firstColumn + index)
    )
    const RowDisc = 34
</script>

{#each KnightSections as section (section.section)}
    <g data-section={section.section}>
        <svg
            x={knightSectionMiddle(section.firstColumn, section.lastColumn) - 20}
            y={KnightSectionHeaderY - 10}
            width="20"
            height="20"
            viewBox="0 0 24 24"
        >
            <path
                d={BarrelPath}
                fill="var(--feudum-wood-piece)"
                stroke="var(--feudum-ink)"
                stroke-width="1.5"
            ></path>
        </svg>
        <text
            x={knightSectionMiddle(section.firstColumn, section.lastColumn) + 8}
            y={KnightSectionHeaderY + 6}
            text-anchor="middle"
            font-size="16"
            fill="var(--feudum-ink)">{section.section}</text
        >
    </g>
{/each}

{#each state.guilds.knight.rows as row (row.colour)}
    {@const paint = row.playerId ? paintOf(row.playerId) : colourPaintOf(row.colour)}
    {@const label = knightRowLabel(row.colour)}
    <g data-knight-row={row.colour} data-markers={row.markers}>
        <SeatToken
            kind="disc"
            {paint}
            size={RowDisc}
            x={label.x - RowDisc / 2}
            y={label.y - RowDisc / 2}
        />
        {#each Columns as column (column)}
            {@const at = knightCell(row.colour, column)}
            <rect
                x={at.x - KnightCell / 2}
                y={at.y - KnightCell / 2}
                width={KnightCell}
                height={KnightCell}
                rx="6"
                fill="var(--feudum-parchment-shade)"
                stroke="var(--feudum-ink)"
                stroke-width={KnightSections.some(({ firstColumn }) => firstColumn === column)
                    ? 2.5
                    : 1}
            ></rect>
            {#if column <= row.markers}
                <BoardPiece {at} piece="knight:{row.colour}:{column}">
                    <SeatToken
                        kind="marker"
                        {paint}
                        size={GuildSizes.marker}
                        x={-GuildSizes.marker / 2}
                        y={-GuildSizes.marker / 2}
                    />
                </BoardPiece>
            {/if}
        {/each}
    </g>
{/each}

{#each KnightMonsterIcons as icon (icon.id)}
    {@const at = guildSlot(icon.id)}
    {@const controller = state.guilds.knight.monsterIcons[icon.monster]}
    <g data-monster-icon={icon.monster}>
        <rect
            x={at.x - MonsterBox.width / 2}
            y={at.y - MonsterBox.height / 2}
            width={MonsterBox.width}
            height={MonsterBox.height}
            rx="8"
            fill="var(--feudum-parchment-shade)"
            stroke="var(--feudum-ink)"
        ></rect>
        <MonsterToken
            monster={icon.monster}
            size={GuildSizes.monster}
            x={at.x - GuildSizes.monster / 2}
            y={at.y - GuildSizes.monster / 2 - 12}
        />
        <text
            x={at.x}
            y={at.y + MonsterBox.height / 2 - 10}
            text-anchor="middle"
            font-size="15"
            fill="var(--feudum-ink)">{icon.markers} markers</text
        >
    </g>
    {#if controller}
        <BoardPiece at={{ x: at.x + 46, y: at.y - 40 }} piece="monster-icon:{icon.monster}">
            <SeatToken
                kind="marker"
                paint={paintOf(controller)}
                size={GuildSizes.marker}
                x={-GuildSizes.marker / 2}
                y={-GuildSizes.marker / 2}
            />
        </BoardPiece>
    {/if}
{/each}
