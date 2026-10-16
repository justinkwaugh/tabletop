<script lang="ts">
    import { leagueLevelText, leagueUsername } from '$lib/utils/leaguePresentation'
    import {
        leagueLevelName,
        type LeagueGroupDetail,
        type LeagueGroupStanding
    } from '@tabletop/common'

    let {
        group,
        gamesPerEntrant,
        usernames,
        userId
    }: {
        group: LeagueGroupDetail
        gamesPerEntrant: number
        usernames: Record<string, string>
        userId?: string
    } = $props()
    let showTiebreak = $derived(group.standings.some((row) => row.tiebreak !== undefined))
    const movementLabel = { promoted: 'Promoted', relegated: 'Relegated' }

    function gameStates(row: LeagueGroupStanding) {
        return Array.from({ length: gamesPerEntrant }, (_, index) =>
            index < row.completed
                ? 'finished'
                : index < row.completed + row.active
                  ? 'active'
                  : 'waiting'
        )
    }

    function gamesTitle(row: LeagueGroupStanding) {
        const waiting = gamesPerEntrant - row.completed - row.active
        return `${row.completed} finished · ${row.active} in progress · ${waiting} waiting`
    }
</script>

<section
    aria-labelledby={`group-${group.groupId}`}
    class="w-full rounded-md border-4 border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-800 sm:w-[18rem]"
>
    <div class="mb-2 flex items-baseline justify-between gap-3">
        <h3 id={`group-${group.groupId}`} class="font-tournament text-lg font-semibold">
            Group {group.groupId}
        </h3>
        <a
            href={`/tournaments/${group.tournamentId}`}
            class="text-xs text-blue-700 hover:text-blue-500 dark:text-blue-300"
            >{group.tournamentStatus === 'finished' ? 'Results' : 'Games'} →</a
        >
    </div>
    <div class="mb-2 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
        <div
            class="h-1 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
            role="progressbar"
            aria-label={`Group ${group.groupId} games finished`}
            aria-valuemin={0}
            aria-valuemax={group.totalGames}
            aria-valuenow={group.finishedGames}
        >
            <div
                class="h-full rounded-full {group.finishedGames === group.totalGames
                    ? 'bg-green-600'
                    : 'bg-blue-600'}"
                style:width={`${group.totalGames ? (group.finishedGames / group.totalGames) * 100 : 0}%`}
            ></div>
        </div>
        <span class="tabular-nums">{group.finishedGames} of {group.totalGames} games</span>
    </div>
    <table class="w-full table-fixed text-left text-sm">
        <thead
            class="border-b border-gray-200 text-xs text-gray-500 dark:border-gray-700/60 dark:text-gray-400"
        >
            <tr>
                <th class="w-5 pb-1.5 font-normal"><span class="sr-only">Place</span></th>
                <th class="pb-1.5 font-normal">Name</th>
                <th class="w-7 pb-1.5 text-right font-normal"
                    ><abbr class="no-underline" title="Wins">W</abbr></th
                >
                <th class="w-11 pb-1.5 text-right font-normal"
                    ><abbr class="no-underline" title="Points">Pts</abbr></th
                >
                <th class="w-12 pb-1.5 text-right font-normal">Games</th>
                {#if showTiebreak}
                    <th class="w-9 pb-1.5 text-right font-normal"
                        ><abbr class="no-underline" title="Tiebreak: sum of final scores">TB</abbr
                        ></th
                    >
                {/if}
            </tr>
        </thead>
        <tbody class="divide-y divide-gray-200/60 dark:divide-gray-700/40">
            {#each group.standings as row (row.userId)}
                <tr>
                    <td class="py-1.5 text-xs tabular-nums text-gray-500">{row.place}</td>
                    <td class="py-1.5 pr-2">
                        <span class="flex min-w-0 items-center gap-1.5">
                            <span
                                class="truncate {row.userId === userId
                                    ? 'text-orange-700 dark:text-orange-300'
                                    : ''}"
                                title={leagueUsername(usernames, row.userId)}
                                >{leagueUsername(usernames, row.userId)}</span
                            >
                            {#if row.movement === 'seeded' && row.nextLevel !== undefined}
                                <span
                                    class="shrink-0 rounded bg-gray-100 px-1 text-[0.65rem] leading-4 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                                    title={`${leagueLevelText(row.nextLevel)} next season`}
                                    >{leagueLevelName(row.nextLevel)}</span
                                >
                            {:else if row.movement === 'promoted' || row.movement === 'relegated'}
                                <span
                                    class="shrink-0 text-xs {row.movement === 'promoted'
                                        ? 'text-green-700 dark:text-green-400'
                                        : 'text-red-600 dark:text-red-400'}"
                                    title={movementLabel[row.movement]}
                                    aria-label={movementLabel[row.movement]}
                                    >{row.movement === 'promoted' ? '▲' : '▼'}</span
                                >
                            {/if}
                        </span>
                    </td>
                    <td class="py-1.5 text-right tabular-nums text-gray-400">{row.wins}</td>
                    <td class="py-1.5 text-right tabular-nums"
                        >{Number.isInteger(row.score) ? row.score : row.score.toFixed(2)}</td
                    >
                    <td class="py-1.5 text-right" title={gamesTitle(row)}>
                        <span class="inline-flex gap-0.5" aria-label={gamesTitle(row)}>
                            {#each gameStates(row) as state, index (index)}
                                <span
                                    class="size-1.5 rounded-full {state === 'finished'
                                        ? 'bg-gray-500 dark:bg-gray-300'
                                        : state === 'active'
                                          ? 'bg-blue-500'
                                          : 'border border-gray-300 dark:border-gray-600'}"
                                ></span>
                            {/each}
                        </span>
                    </td>
                    {#if showTiebreak}
                        <td class="py-1.5 text-right tabular-nums text-gray-400"
                            >{row.tiebreak ?? '—'}</td
                        >
                    {/if}
                </tr>
            {/each}
        </tbody>
    </table>
</section>
