<script lang="ts">
    import GuildColumn from '$lib/components/standings/GuildColumn.svelte'
    import {
        DeskColumnSpacing,
        DeskZoomRow,
        type BoardRect,
        type DeskColumn
    } from '$lib/model/boardFocus.svelte.js'
    import { guildStandingsOf } from '$lib/model/guildStandings.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ScoreLine from './ScoreLine.svelte'

    /**
     * Contract, Desk layout: the side column, right of the East button where the map's height binds.
     * Top to bottom it holds the guild standings and the score line; the zoom row (Key, Supply and the
     * zoom buttons) stands under them, along the column's foot (`BoardCorner`). For looking only, as
     * the strip is: a press, a drag or a wheel here never pans or zooms the map.
     */
    let { box, column }: { box: BoardRect; column: DeskColumn } = $props()

    const gameSession = getGameSession()
    const { paintOf } = gameSession

    let standings = $derived(
        guildStandingsOf(gameSession.gameState, (playerId) => gameSession.getPlayerName(playerId))
    )
    let seats = $derived(gameSession.gameState.players.length)

    function keep(event: Event) {
        event.stopPropagation()
    }
</script>

<div
    class="column"
    role="presentation"
    style:left="{box.x}px"
    style:top="{box.y}px"
    style:width="{box.width}px"
    style:height="{Math.max(0, box.height - DeskZoomRow - DeskColumnSpacing)}px"
    style:gap="{DeskColumnSpacing}px"
    data-desk-column
    data-per-row={column.perRow}
    onpointerdown={keep}
    onmousedown={keep}
    ontouchstart={keep}
    onwheel={keep}
>
    <GuildColumn view={standings} {paintOf} {seats} perRow={column.perRow} />
    <ScoreLine stacked />
</div>

<style>
    .column {
        position: absolute;
        z-index: 9;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        cursor: default;
    }
</style>
