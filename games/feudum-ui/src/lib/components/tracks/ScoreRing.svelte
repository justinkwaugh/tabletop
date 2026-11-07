<script lang="ts">
    import { ScoreTrack, type HydratedFeudumGameState } from '@tabletop/feudum'
    import BoardPiece from '$lib/components/map/BoardPiece.svelte'
    import CountChip from '$lib/components/map/CountChip.svelte'
    import SeatToken from '$lib/components/pieces/SeatToken.svelte'
    import { scoreOnTrack } from '$lib/model/boardView.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import {
        ScoreDiscSize,
        ScoreSpaces,
        scoreChipOffset,
        scoreDiscAt
    } from '$lib/utils/boardGeometry.js'

    /**
     * R-1.2.5 The 0 to 149 track round the board's edge. R-6 A score is uncapped: past 149 the disc
     * wraps and carries a "+150" chip. Each seat keeps a lane across the band.
     */
    let {
        state,
        paintOf
    }: {
        state: HydratedFeudumGameState
        paintOf: (playerId: string) => SeatPaint
    } = $props()

    const labelled = (space: number) => space % ScoreTrack.labelEvery === 0
</script>

<g data-score-ring style:font-family="var(--feudum-font-text)">
    {#each ScoreSpaces as { space, centre, width, height } (space)}
        <rect
            x={centre.x - width / 2 + 1}
            y={centre.y - height / 2 + 1}
            width={width - 2}
            height={height - 2}
            rx="3"
            fill={labelled(space) ? 'var(--feudum-wood-dark)' : 'var(--feudum-score-cell)'}
            data-score-space={space}
        ></rect>
        {#if labelled(space)}
            <text
                x={centre.x}
                y={centre.y + 7}
                text-anchor="middle"
                font-size="20"
                fill="var(--feudum-parchment)">{space}</text
            >
        {/if}
    {/each}
</g>

{#each state.players as player, lane (player.playerId)}
    {@const onTrack = scoreOnTrack(player.score)}
    {@const chip = scoreChipOffset(onTrack.space)}
    <BoardPiece at={scoreDiscAt(onTrack.space, lane)} piece="score:{player.playerId}">
        <SeatToken
            kind="disc"
            paint={paintOf(player.playerId)}
            size={ScoreDiscSize}
            x={-ScoreDiscSize / 2}
            y={-ScoreDiscSize / 2}
        />
        {#if onTrack.chip}
            <g data-score-chip={onTrack.chip}>
                <CountChip count={onTrack.chip} x={chip.x} y={chip.y} />
            </g>
        {/if}
    </BoardPiece>
{/each}
