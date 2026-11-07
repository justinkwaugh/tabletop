<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { Color } from '@tabletop/common'
    import { GuildById, type GuildId, type HydratedFeudumGameState } from '@tabletop/feudum'
    import GuildIcon from '$lib/components/pieces/GuildIcon.svelte'
    import PieceFrame from '$lib/components/pieces/PieceFrame.svelte'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import {
        CrestCentre,
        GuildAreaWidth,
        GuildBox,
        GuildViewBox
    } from '$lib/utils/boardGeometry.js'
    import AlchemistGoods from './AlchemistGoods.svelte'
    import FarmerGoods from './FarmerGoods.svelte'
    import GuildTrack from './GuildTrack.svelte'
    import KnightGoods from './KnightGoods.svelte'
    import MerchantGoods from './MerchantGoods.svelte'
    import MonkGoods from './MonkGoods.svelte'
    import NobleGoods from './NobleGoods.svelte'

    /**
     * One guild area in its own local units: crest, track and goods area, all from state. The board
     * and the bench draw this same component, the width alone setting the scale. It nests in the
     * board's SVG or stands in HTML; `over` draws in local units, above everything, for what a user
     * of it adds (lights, ghosts).
     */
    let {
        guild,
        state,
        paintOf,
        colourPaintOf,
        width = GuildAreaWidth,
        x,
        y,
        over
    }: {
        guild: GuildId
        state: HydratedFeudumGameState
        paintOf: (playerId: string) => SeatPaint
        colourPaintOf: (colour: Color) => SeatPaint
        width?: number
        x?: number
        y?: number
        over?: Snippet
    } = $props()

    const CrestRadius = 30
    const CrestIcon = 36
    let height = $derived((width * GuildBox.height) / GuildBox.width)
</script>

<PieceFrame
    label="{GuildById[guild].name} guild"
    {width}
    {height}
    viewBox={GuildViewBox}
    {x}
    {y}
    {over}
>
    <g data-guild={guild} style:font-family="var(--feudum-font-text)">
        <rect
            x="1.5"
            y="1.5"
            width={GuildBox.width - 3}
            height={GuildBox.height - 3}
            rx="12"
            fill="var(--feudum-parchment)"
            stroke="var(--feudum-board-frame)"
            stroke-width="3"
        ></rect>
        <circle
            cx={CrestCentre.x}
            cy={CrestCentre.y}
            r={CrestRadius}
            fill="var(--feudum-wood-piece)"
            stroke="var(--feudum-wood-dark)"
            stroke-width="2"
        ></circle>
        <GuildIcon
            {guild}
            size={CrestIcon}
            x={CrestCentre.x - CrestIcon / 2}
            y={CrestCentre.y - CrestIcon / 2}
            ink="var(--feudum-ink)"
        />
        <text
            x={CrestCentre.x + CrestRadius + 12}
            y={CrestCentre.y + 10}
            font-size="30"
            fill="var(--feudum-ink)"
            style:font-family="var(--feudum-font-title)">{GuildById[guild].name}</text
        >
        <GuildTrack {guild} {state} {paintOf} />
        {#if guild === 'farmer'}
            <FarmerGoods {state} />
        {:else if guild === 'merchant'}
            <MerchantGoods {state} />
        {:else if guild === 'alchemist'}
            <AlchemistGoods {state} />
        {:else if guild === 'knight'}
            <KnightGoods {state} {paintOf} {colourPaintOf} />
        {:else if guild === 'noble'}
            <NobleGoods {state} />
        {:else}
            <MonkGoods {state} />
        {/if}
    </g>
</PieceFrame>
