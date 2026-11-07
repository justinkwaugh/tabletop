<script lang="ts">
    import WritFace from '$lib/components/pieces/WritFace.svelte'
    import type { SeatNames } from '$lib/model/actionPanel.js'
    import type { GameEndSummaryView } from '$lib/model/gameEnd.js'

    /** R-6.2, R-6.3 One column per seat: every category, sealed charters face up, and the winner. */
    let { summary, seats }: { summary: GameEndSummaryView; seats: SeatNames } = $props()

    const CharterWidth = 72
</script>

<div class="w-full overflow-x-auto" data-game-end>
    <p class="text-sm font-semibold text-feudum-text" data-game-winner>{summary.winnerLine}</p>
    {#if summary.tieBreak}
        <p class="text-xs text-feudum-text-muted" data-game-tie-break>{summary.tieBreak}</p>
    {/if}
    <table class="mt-1 text-xs text-feudum-text">
        <thead>
            <tr>
                <th class="pr-3 text-left font-normal"></th>
                {#each summary.columns as column (column.playerId)}
                    <th
                        class="pr-3 text-left font-semibold"
                        data-game-end-seat={seats.nameOf(column.playerId)}
                        data-winner={column.winner ? '' : undefined}
                    >
                        <span
                            class="mr-1 inline-block h-2.5 w-2.5 rounded-full"
                            style:background-color={seats.paintOf(column.playerId).fill}
                        ></span>{seats.nameOf(column.playerId)}
                    </th>
                {/each}
            </tr>
        </thead>
        <tbody>
            <tr data-game-end-row="dawn">
                <td class="pr-3 text-feudum-text-muted">V dawn</td>
                {#each summary.columns as column (column.playerId)}
                    <td class="pr-3">{column.fifthDawn}</td>
                {/each}
            </tr>
            <tr data-game-end-row="voyage">
                <td class="pr-3 text-feudum-text-muted">Epic voyage</td>
                {#each summary.columns as { playerId, voyage } (playerId)}
                    <td class="pr-3">{voyage.label} · {voyage.vp}</td>
                {/each}
            </tr>
            <tr data-game-end-row="empire">
                <td class="pr-3 text-feudum-text-muted">Large empire</td>
                {#each summary.columns as { playerId, largeEmpire } (playerId)}
                    <td class="pr-3">{largeEmpire.label} · {largeEmpire.vp}</td>
                {/each}
            </tr>
            <tr data-game-end-row="shillings">
                <td class="pr-3 text-feudum-text-muted">Shillings</td>
                {#each summary.columns as { playerId, shillings } (playerId)}
                    <td class="pr-3">{shillings.label} · {shillings.vp}</td>
                {/each}
            </tr>
            <tr data-game-end-row="charters">
                <td class="pr-3 align-top text-feudum-text-muted">Sealed charters</td>
                {#each summary.columns as { playerId, charters } (playerId)}
                    <td class="pr-3 align-top">
                        {#each charters as { writId, vp } (writId)}
                            <span class="mr-1 inline-flex flex-col" data-game-end-charter={writId}>
                                <WritFace faceShown {writId} width={CharterWidth} />
                                <span>{vp}</span>
                            </span>
                        {:else}
                            –
                        {/each}
                    </td>
                {/each}
            </tr>
            <tr class="font-semibold" data-game-end-row="total">
                <td class="pr-3">Total</td>
                {#each summary.columns as { playerId, score } (playerId)}
                    <td class="pr-3">{score}</td>
                {/each}
            </tr>
        </tbody>
    </table>
</div>
