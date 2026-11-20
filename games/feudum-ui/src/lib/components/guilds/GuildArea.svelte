<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { Color } from '@tabletop/common'
    import { GuildById, type GuildId, type HydratedFeudumGameState } from '@tabletop/feudum'
    import PieceFrame from '$lib/components/pieces/PieceFrame.svelte'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import { GuildAreaWidth, GuildBox, GuildViewBox } from '$lib/utils/boardGeometry.js'
    import AlchemistGoods from './AlchemistGoods.svelte'
    import FarmerGoods from './FarmerGoods.svelte'
    import GuildPanel from './GuildPanel.svelte'
    import GuildTrack from './GuildTrack.svelte'
    import KnightGoods from './KnightGoods.svelte'
    import MerchantGoods from './MerchantGoods.svelte'
    import MonkGoods from './MonkGoods.svelte'
    import NobleGoods from './NobleGoods.svelte'

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
        <GuildPanel {guild} />
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
