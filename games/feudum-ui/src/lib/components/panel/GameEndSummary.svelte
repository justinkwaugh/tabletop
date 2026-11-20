<script lang="ts">
    import WritFace from '$lib/components/pieces/WritFace.svelte'
    import Enlargeable from '$lib/components/table/Enlargeable.svelte'
    import type { SeatNames } from '$lib/model/actionPanel.js'
    import type { GameEndSummaryView } from '$lib/model/gameEnd.js'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'
    import { writName } from '$lib/model/writLabels.js'
    import SeatChip from './SeatChip.svelte'

    /** R-6.2, R-6.3 The final scores; a phone shows one row per seat (contract: Phone layout). */
    let { summary, seats }: { summary: GameEndSummaryView; seats: SeatNames } = $props()

    const CharterWidth = 72
    const PhoneCharterWidth = 44
    const phone = new PhoneLayout()
</script>

{#snippet chips(playerIds: readonly string[], barrels?: readonly number[])}
    {#each playerIds as playerId, index (playerId)}{#if index > 0}<span class="sr-only"
                >{index === playerIds.length - 1 ? ' and ' : ', '}</span
            >{/if}<span class="inline-flex items-center gap-0.5"
            ><SeatChip
                name={seats.nameOf(playerId)}
                paint={seats.paintOf(playerId)}
            />{#if barrels}<span>{` ${barrels[index]}`}</span>{/if}</span
        >{/each}
{/snippet}

<div class="w-full overflow-x-auto" data-game-end>
    <p
        class="flex flex-wrap items-center gap-1 text-sm font-semibold text-feudum-text"
        data-game-winner
    >
        {@render chips(summary.winners)}
        {summary.winners.length === 1 ? 'wins' : 'win'}
    </p>
    {#if summary.tieBreak}
        {@const tie = summary.tieBreak}
        <p
            class="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-feudum-text-muted"
            data-game-tie-break
        >
            {#if tie.broken}
                Tie broken by barrel sulfur:
                {@render chips(
                    tie.seats.map(({ playerId }) => playerId),
                    tie.seats.map(({ barrel }) => barrel)
                )}
            {:else}
                Tie:
                {@render chips(tie.seats.map(({ playerId }) => playerId))}
            {/if}
            {#if tie.shared}· shared win{/if}
        </p>
    {/if}
    {#if phone.phone}
        <div class="mt-1 flex flex-col gap-1 text-xs leading-tight text-feudum-text">
            {#each summary.columns as column (column.playerId)}
                <div
                    class="flex gap-1.5 rounded-md bg-feudum-surface-raised px-1.5 py-0.5"
                    data-game-end-seat={seats.nameOf(column.playerId)}
                    data-winner={column.winner ? '' : undefined}
                >
                    <div class="min-w-0 grow">
                        <p class="flex items-center gap-1 font-semibold">
                            <span
                                class="inline-block h-2.5 w-2.5 rounded-full"
                                style:background-color={seats.paintOf(column.playerId).fill}
                            ></span>
                            {seats.nameOf(column.playerId)}
                            <span class="ml-auto" data-game-end-row="total">{column.score}</span>
                        </p>
                        <p>
                            <span data-game-end-row="before-dawn"
                                ><span class="text-feudum-text-muted">Before V dawn</span>
                                {column.beforeDawn}</span
                            >
                            ·
                            <span data-game-end-row="dawn"
                                ><span class="text-feudum-text-muted">V dawn</span>
                                {column.fifthDawn}</span
                            >
                            ·
                            <span data-game-end-row="voyage"
                                ><span class="text-feudum-text-muted">Epic voyage</span>
                                {column.voyage.label} · {column.voyage.vp}</span
                            >
                            ·
                            <span data-game-end-row="empire"
                                ><span class="text-feudum-text-muted">Large empire</span>
                                {column.largeEmpire.label} · {column.largeEmpire.vp}</span
                            >
                            ·
                            <span data-game-end-row="shillings"
                                ><span class="text-feudum-text-muted">Shillings</span>
                                {column.shillings.label} · {column.shillings.vp}</span
                            >
                        </p>
                    </div>
                    {#if column.charters.length > 0}
                        <div class="flex shrink-0 items-start gap-1" data-game-end-row="charters">
                            {#each column.charters as { writId, vp } (writId)}
                                <span
                                    class="inline-flex flex-col items-center"
                                    data-game-end-charter={writId}
                                >
                                    <Enlargeable
                                        tag="div"
                                        label={writName(writId)}
                                        face={() => ({ kind: 'writ', faceShown: true, writId })}
                                    >
                                        <WritFace faceShown {writId} width={PhoneCharterWidth} />
                                    </Enlargeable>
                                    <span data-charter-score>{vp} vp</span>
                                </span>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {:else}
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
                <tr data-game-end-row="before-dawn">
                    <td class="pr-3 text-feudum-text-muted">Before V dawn</td>
                    {#each summary.columns as column (column.playerId)}
                        <td class="pr-3">{column.beforeDawn}</td>
                    {/each}
                </tr>
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
                                <span
                                    class="mr-1 inline-flex flex-col"
                                    data-game-end-charter={writId}
                                >
                                    <WritFace faceShown {writId} width={CharterWidth} />
                                    <span data-charter-score>{vp} vp</span>
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
    {/if}
</div>
