<script lang="ts">
    import { onMount } from 'svelte'
    import { getAppContext } from '$lib/stores/appContext.svelte'

    import { generateSeed, type TournamentDetail, type TournamentSchedule } from '@tabletop/common'

    const { api, authorizationService } = getAppContext()
    let user = $derived(authorizationService.getSessionUser())

    let {
        detail,
        isAdmin = false,
        onsaved
    }: {
        detail: TournamentDetail
        isAdmin?: boolean
        onsaved: () => void
    } = $props()
    let preview = $state<{ schedule: TournamentSchedule; revision: number }>()
    let saved = $state<TournamentSchedule>()
    let schedule = $derived(
        saved ?? (preview?.revision === detail.tournament.revision ? preview.schedule : undefined)
    )
    let busy = $state(false)
    let error = $state('')
    let page = $state(0)
    let names = $derived(
        new Map(
            detail.tournament.entrants.map((entrant) => [
                entrant.userId,
                detail.usernames[entrant.userId] ?? 'Unavailable account'
            ])
        )
    )
    let visibleTables = $derived(schedule?.tables.slice(page * 20, (page + 1) * 20) ?? [])
    let gamesByTable = $derived(
        new Map(
            (detail.games ?? [])
                .filter((game) => game.stageId === schedule?.stageId)
                .map((game) => [game.tableId, game])
        )
    )

    async function generate() {
        busy = true
        error = ''
        const revision = detail.tournament.revision
        try {
            const schedule = await api.previewTournamentSchedule(detail.tournament.id, {
                revision,
                seed: generateSeed(),
                version: 1
            })
            preview = { schedule, revision }
            page = 0
        } catch (failure) {
            error = failure instanceof Error ? failure.message : 'Could not preview schedule'
        } finally {
            busy = false
        }
    }
    async function commit() {
        if (!schedule || !preview) return
        busy = true
        error = ''
        try {
            saved = await api.commitTournamentSchedule(detail.tournament.id, {
                revision: preview.revision,
                seed: schedule.seed,
                version: schedule.version,
                scheduleId: schedule.id
            })
            onsaved()
        } catch (failure) {
            error = failure instanceof Error ? failure.message : 'Could not save schedule'
        } finally {
            busy = false
        }
    }
    onMount(() => {
        if (!detail.tournament.stages[0]?.scheduleId) return
        void api
            .getTournamentSchedule(detail.tournament.id)
            .then((value) => (saved = value))
            .catch((failure) => {
                error = failure instanceof Error ? failure.message : 'Could not load schedule'
            })
    })
</script>

<section aria-labelledby="schedule-heading">
    <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 id="schedule-heading" class="font-tournament text-lg font-semibold">
            Schedule{schedule && !saved ? ' preview' : ''}
        </h2>
        {#if isAdmin && !detail.tournament.stages[0]?.scheduleId && detail.tournament.status === 'locked'}
            <div class="flex gap-2">
                <button class="schedule-action" disabled={busy} onclick={generate}
                    >{busy && !schedule
                        ? 'Preparing…'
                        : schedule
                          ? 'New draw'
                          : 'Preview schedule'}</button
                >
                {#if schedule}<button
                        class="schedule-action bg-blue-600 text-white"
                        disabled={busy}
                        onclick={commit}>Save schedule</button
                    >{/if}
            </div>
        {/if}
    </div>
    {#if error}<p role="alert" class="mt-2 text-xs text-red-600 dark:text-red-300">{error}</p>{/if}
    {#if schedule}
        <div class="mt-3 overflow-x-auto rounded-md bg-gray-50 dark:bg-gray-800">
            <table class="w-full text-left text-xs">
                <thead class="text-gray-500 dark:text-gray-400"
                    ><tr>
                        <th
                            class="sticky left-0 z-10 bg-gray-50 px-3 py-2 font-normal dark:bg-gray-800"
                            >Table</th
                        >
                        {#each Array.from({ length: schedule.tableSize }, (_, index) => index + 1) as position}<th
                                class="px-3 py-2 font-normal whitespace-nowrap">Seat {position}</th
                            >{/each}
                        <th class="w-0 p-0"><span class="sr-only">Game</span></th>
                    </tr></thead
                >
                <tbody
                    >{#each visibleTables as table, index (table.id)}
                        {@const isMine = table.entrantIds.some((id) => id === user?.id)}
                        {@const game = gamesByTable.get(table.id)}
                        {@const href = game ? `/game/${game.gameId}` : undefined}
                        {@const dispatch = detail.tournament.stages[0]?.dispatch}
                        {@const waiting = detail.tournament.paused
                            ? 'Scheduling paused'
                            : dispatch?.reserved.includes(table.id)
                              ? 'Starting this game'
                              : table.entrantIds.some((id) => !detail.usernames[id])
                                ? 'Waiting for active accounts'
                                : detail.tournament.nextTaskAt !== undefined || !dispatch
                                  ? 'Waiting to be scheduled'
                                  : 'Waiting for player capacity'}
                        <tr
                            title={game ? undefined : waiting}
                            class="group border-t border-gray-200/60 dark:border-gray-700/50 {game
                                ? 'game-row'
                                : ''} {isMine ? 'own-game' : ''} {isMine
                                ? 'bg-black/5 dark:bg-black/20'
                                : ''}"
                        >
                            <td
                                class="sticky left-0 z-10 tabular-nums {isMine
                                    ? 'my-table bg-[color-mix(in_srgb,var(--color-gray-50),black_5%)] dark:bg-[color-mix(in_srgb,var(--color-gray-800),black_20%)]'
                                    : 'bg-gray-50 dark:bg-gray-800'}"
                            >
                                {#if href}<a
                                        class="block px-3 py-2"
                                        {href}
                                        aria-label={`Open table ${page * 20 + index + 1}`}
                                        >{page * 20 + index + 1}</a
                                    >{:else}<span class="block px-3 py-2"
                                        >{page * 20 + index + 1}</span
                                    >{/if}
                            </td>
                            {#each table.entrantIds as entrant}
                                {#snippet playerName()}
                                    <span
                                        class="truncate {entrant === user?.id
                                            ? 'text-orange-700 dark:text-orange-300'
                                            : ''}"
                                        title={names.get(entrant)}>{names.get(entrant)}</span
                                    >
                                {/snippet}
                                <td>
                                    {#if href}<a
                                            class="flex max-w-48 items-center gap-1.5 px-3 py-2"
                                            {href}
                                        >
                                            {@render playerName()}
                                        </a>{:else}<span
                                            class="flex max-w-48 items-center gap-1.5 px-3 py-2"
                                            >{@render playerName()}</span
                                        >{/if}
                                </td>{/each}
                            <td class="sticky right-0 z-20 w-0 p-0">
                                {#if game}<a
                                        class="game-action absolute inset-y-px right-px flex items-center gap-1 px-3 font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 {isMine
                                            ? 'bg-[color-mix(in_srgb,var(--color-gray-50),black_5%)] text-orange-700 dark:bg-[color-mix(in_srgb,var(--color-gray-800),black_20%)] dark:text-orange-300'
                                            : 'bg-gray-50 text-green-700 dark:bg-gray-800 dark:text-green-400'}"
                                        href={`/game/${game.gameId}`}
                                        aria-label={`${isMine ? 'Play' : 'View'} table ${page * 20 + index + 1}`}
                                        >{isMine ? 'Play' : 'View'}
                                        <span aria-hidden="true">→</span></a
                                    >{/if}
                            </td>
                        </tr>{/each}</tbody
                >
            </table>
        </div>
        <footer class="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
            <p>
                <span class="text-gray-500 dark:text-gray-400">Games each</span>
                {schedule.gamesPerEntrant}
            </p>
            <p>
                <span class="text-gray-500 dark:text-gray-400">Each seat</span>
                {schedule.gamesPerEntrant / schedule.tableSize}×
            </p>
            <p>
                {#if schedule.quality.opponentCounts.length === 1}
                    <span class="text-gray-500 dark:text-gray-400">Every pair meets</span>
                    {schedule.quality.opponentCounts[0].games}×
                {:else}
                    <span class="text-gray-500 dark:text-gray-400">Opponents meet</span>
                    {schedule.quality.opponentCounts[0].games}–{schedule.quality.opponentCounts.at(
                        -1
                    )?.games}×
                {/if}
            </p>
            <p>
                <span class="text-gray-500 dark:text-gray-400">Repeated groups</span>
                {schedule.quality.repeatedTables}
            </p>
        </footer>
        {#if schedule.tables.length > 20}<div
                class="mt-2 flex items-center justify-end gap-3 text-xs"
            >
                <button class="schedule-action" disabled={page === 0} onclick={() => page--}
                    >Previous</button
                >
                <span>{page + 1} / {Math.ceil(schedule.tables.length / 20)}</span>
                <button
                    class="schedule-action"
                    disabled={(page + 1) * 20 >= schedule.tables.length}
                    onclick={() => page++}>Next</button
                >
            </div>{/if}
        {#if !saved}<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Starting positions and game counts are equal. This draw is a balanced candidate;
                other draws may have different opponent matchups.
            </p>{/if}
    {:else if !detail.tournament.stages[0]?.scheduleId}
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
            The roster is locked. Preview the tables and starting positions before saving.
        </p>
    {/if}
</section>

<style>
    .game-row {
        --row-outline: var(--color-blue-400);
    }
    .game-row.own-game {
        --row-outline: var(--color-orange-400);
    }
    .game-row:hover > td,
    .game-row:focus-within > td {
        box-shadow:
            inset 0 1px var(--row-outline),
            inset 0 -1px var(--row-outline);
    }
    .game-row.own-game:hover > td:first-child,
    .game-row.own-game:focus-within > td:first-child {
        box-shadow:
            inset 2px 0 var(--color-orange-400),
            inset 0 1px var(--row-outline),
            inset 0 -1px var(--row-outline);
    }
    .game-action {
        box-shadow: -8px 0 8px -4px var(--color-gray-50);
    }
    :global(.dark) .game-action {
        box-shadow: -8px 0 8px -4px var(--color-gray-800);
    }

    .my-table {
        box-shadow: inset 2px 0 var(--color-orange-400);
    }
    .schedule-action {
        border: 1px solid var(--color-gray-500);
        border-radius: 0.375rem;
        padding: 0.375rem 0.625rem;
        font-size: 0.75rem;
        line-height: 1rem;
    }
    .schedule-action:disabled {
        opacity: 0.5;
    }
    .schedule-action:focus-visible {
        outline: 2px solid var(--color-blue-400);
        outline-offset: 2px;
    }
</style>
