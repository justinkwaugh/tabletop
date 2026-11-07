<script lang="ts">
    import type { Color } from '@tabletop/common'
    import { GuildIds, type HydratedFeudumGameState } from '@tabletop/feudum'
    import PickChrome from '$lib/components/map/PickChrome.svelte'
    import { PlainChrome, dimmed, type BoardChrome } from '$lib/model/boardChrome.js'
    import { guildTarget, roleOf } from '$lib/model/boardOffer.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import { GuildAreaHeight, GuildAreaWidth, GuildAreas } from '$lib/utils/boardGeometry.js'
    import GuildArea from './GuildArea.svelte'

    /** R-1.2.3 The six guild areas where they stand on the board. */
    let {
        state,
        paintOf,
        colourPaintOf,
        chrome = PlainChrome
    }: {
        state: HydratedFeudumGameState
        paintOf: (playerId: string) => SeatPaint
        colourPaintOf: (colour: Color) => SeatPaint
        chrome?: BoardChrome
    } = $props()
</script>

{#each GuildIds as guild (guild)}
    {@const target = guildTarget(guild)}
    <g opacity={dimmed(roleOf(chrome.offer, target))}>
        <GuildArea
            {guild}
            {state}
            {paintOf}
            {colourPaintOf}
            x={GuildAreas[guild].x}
            y={GuildAreas[guild].y}
        />
    </g>
    <PickChrome
        {target}
        {chrome}
        at={{
            x: GuildAreas[guild].x + GuildAreaWidth / 2,
            y: GuildAreas[guild].y + GuildAreaHeight / 2
        }}
        width={GuildAreaWidth}
        height={GuildAreaHeight}
        round={false}
        label={guild}
    />
{/each}
