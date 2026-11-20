<script lang="ts">
    import Level from './Level.svelte'
    import {
        KnightMonsterIcons,
        KnightSections,
        knightRows,
        type HydratedFeudumGameState
    } from '@tabletop/feudum'
    import type { Color } from '@tabletop/common'
    import BoardPiece from '$lib/components/map/BoardPiece.svelte'
    import MonsterToken from '$lib/components/pieces/MonsterToken.svelte'
    import SeatToken from '$lib/components/pieces/SeatToken.svelte'
    import { knightMarkerPiece, rowLane } from '$lib/model/knightLanes.js'
    import { ownerPaint, type SeatPaint } from '$lib/model/seatPaint.js'
    import {
        GuildSizes,
        KnightCell,
        KnightSectionHeaderY,
        MonsterBox,
        guildPrinted,
        guildSlot,
        knightCell,
        knightRowLabel,
        knightSectionMiddle,
        monsterIconMarker
    } from '$lib/utils/boardGeometry.js'
    import { PrintedSizes } from '$lib/utils/printedGuilds.js'
    import { BarrelPath } from '$lib/utils/trackShape.js'

    /**
     * R-1.3 One row per seat and dummy row, each of three barrel sections, in its printed lane; a dummy
     * row wears a colour no seat is shown in and is named by it, with no seat behind it (R-1.4-H1). R-4.2.4 Each monster's icon carries the marker of whoever controls it.
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
    /** The printed panel draws the sections, the cells and the beasts; rows and markers stand on it. */
    let printed = $derived(guildPrinted('knight'))
    let marker = $derived(printed ? PrintedSizes.knightMarker : GuildSizes.marker)
</script>

{#if !printed}
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
            <Level
                at={{
                    x: knightSectionMiddle(section.firstColumn, section.lastColumn) + 8,
                    y: KnightSectionHeaderY + 6
                }}
                ><text
                    x={knightSectionMiddle(section.firstColumn, section.lastColumn) + 8}
                    y={KnightSectionHeaderY + 6}
                    text-anchor="middle"
                    font-size="16"
                    fill="var(--feudum-ink)">{section.section}</text
                ></Level
            >
        </g>
    {/each}
{/if}
{#each knightRows(state) as { rowId, row } (rowId)}
    {@const paint = ownerPaint(row.owner, paintOf, colourPaintOf)}
    {@const lane = rowLane(state, row.owner)}
    {@const label = knightRowLabel(lane)}
    <g data-knight-row={lane} data-row-id={rowId} data-markers={row.markers}>
        <SeatToken
            kind="disc"
            {paint}
            size={RowDisc}
            x={label.x - RowDisc / 2}
            y={label.y - RowDisc / 2}
        />
        {#each Columns as column (column)}
            {@const at = knightCell(lane, column)}
            {#if !printed}
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
            {/if}
            {#if column <= row.markers}
                <BoardPiece {at} piece={knightMarkerPiece(rowId, column)}>
                    <SeatToken
                        kind="marker"
                        {paint}
                        size={marker}
                        x={-marker / 2}
                        y={-marker / 2}
                    />
                </BoardPiece>
            {/if}
        {/each}
    </g>
{/each}

{#each KnightMonsterIcons as icon (icon.id)}
    {@const at = guildSlot(icon.id)}
    {@const controller = state.monsters[icon.monster].playerId}
    {#if !printed}
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
            <Level at={{ x: at.x, y: at.y + MonsterBox.height / 2 - 10 }}
                ><text
                    x={at.x}
                    y={at.y + MonsterBox.height / 2 - 10}
                    text-anchor="middle"
                    font-size="15"
                    fill="var(--feudum-ink)">{icon.markers} markers</text
                ></Level
            >
        </g>
    {/if}
    {#if controller}
        <BoardPiece at={monsterIconMarker(icon.id)} piece="monster-icon:{icon.monster}">
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
