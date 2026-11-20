<script lang="ts">
    import { ScoreTrack, type HydratedFeudumGameState } from '@tabletop/feudum'
    import { ringPrint } from '$lib/art/assetMap.js'
    import BoardPiece from '$lib/components/map/BoardPiece.svelte'
    import CountChip from '$lib/components/map/CountChip.svelte'
    import SeatToken from '$lib/components/pieces/SeatToken.svelte'
    import { scoreDiscs, seatScores, type ScoreDisc } from '$lib/model/boardView.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import {
        ScoreDiscSize,
        ScoreSpaces,
        scoreChipOffset,
        scoreDiscAt
    } from '$lib/utils/boardGeometry.js'

    /** R-1.2.5 The 0 to 149 track. R-6 A score is uncapped: past 149 it wraps with "+150". */
    let {
        state,
        paintOf,
        dim
    }: {
        state: HydratedFeudumGameState
        paintOf: (playerId: string) => SeatPaint
        /** Phone rendering, effects stay piece-sized: each cell and disc dims as itself. */
        dim?: number
    } = $props()

    const labelled = (space: number) => space % ScoreTrack.labelEvery === 0
    const printed = ringPrint() !== undefined

    let discs = $derived(scoreDiscs(seatScores(state)))
    const on = (disc: ScoreDisc) => `${paintOf(disc.playerId).owner} on ${disc.score}`
    const labelOf = (disc: ScoreDisc) =>
        disc.count > 1
            ? `Player discs: ${discs
                  .filter(({ space }) => space === disc.space)
                  .map(on)
                  .join(', ')}`
            : `${paintOf(disc.playerId).owner} player disc on ${disc.score}`
</script>

<g data-score-ring style:font-family="var(--feudum-font-text)">
    {#each ScoreSpaces as { space, centre, width, height } (space)}
        <rect
            x={centre.x - width / 2 + 1}
            y={centre.y - height / 2 + 1}
            width={width - 2}
            height={height - 2}
            rx="3"
            opacity={printed ? undefined : dim}
            fill={printed
                ? 'none'
                : labelled(space)
                  ? 'var(--feudum-wood-dark)'
                  : 'var(--feudum-score-cell)'}
            data-score-space={space}
        ></rect>
        {#if labelled(space) && !printed}
            <text
                x={centre.x}
                y={centre.y + 7}
                text-anchor="middle"
                font-size="20"
                opacity={dim}
                fill="var(--feudum-parchment)">{space}</text
            >
        {/if}
    {/each}
</g>

{#each discs as disc (disc.playerId)}
    {@const chip = scoreChipOffset(disc.space)}
    <BoardPiece at={scoreDiscAt(disc.space, disc.index, disc.count)} piece="score:{disc.playerId}">
        <g opacity={dim}>
            <SeatToken
                kind="disc"
                paint={paintOf(disc.playerId)}
                size={ScoreDiscSize}
                x={-ScoreDiscSize / 2}
                y={-ScoreDiscSize / 2}
                label={labelOf(disc)}
            />
            {#if disc.chip}
                <g data-score-chip={disc.chip}>
                    <CountChip count={disc.chip} x={chip.x} y={chip.y} />
                </g>
            {/if}
        </g>
    </BoardPiece>
{/each}
