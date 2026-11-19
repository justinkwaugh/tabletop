<script lang="ts">
    import type { Color } from '@tabletop/common'
    import { GuildIds, type HydratedFeudumGameState } from '@tabletop/feudum'
    import { PlainChrome, type BoardChrome } from '$lib/model/boardChrome.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import BoardGuildArea from './BoardGuildArea.svelte'

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
    <BoardGuildArea {guild} {state} {paintOf} {colourPaintOf} {chrome} />
{/each}
