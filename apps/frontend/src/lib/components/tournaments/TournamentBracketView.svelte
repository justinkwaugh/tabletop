<script lang="ts">
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { accountName } from '$lib/utils/accountName'
    import {
        KNOCKOUT_ROUND_VIEW_ABOVE,
        knockoutCurrentMatch,
        knockoutCurrentRound
    } from '$lib/utils/knockoutView'
    import {
        knockoutGameLabel,
        knockoutGameName,
        knockoutMatchName,
        knockoutRoundName,
        type KnockoutBracket,
        type KnockoutMatch,
        type KnockoutMatchGame,
        type KnockoutSide,
        type TournamentDetail
    } from '@tabletop/common'

    let { detail, bracket }: { detail: TournamentDetail; bracket?: KnockoutBracket } = $props()
    const { authorizationService } = getAppContext()
    let user = $derived(authorizationService.getSessionUser())

    let stage = $derived(detail.tournament.stages[0])
    let gamesByTable = $derived(new Map((detail.games ?? []).map((game) => [game.tableId, game])))
    let rounds = $derived(bracket?.rounds.length ?? 0)
    let large = $derived(detail.tournament.entrants.length > KNOCKOUT_ROUND_VIEW_ABOVE)
    let chosen = $state<number | 'all'>()
    let view = $derived(chosen ?? (bracket ? knockoutCurrentRound(bracket) : 1))
    let myMatch = $derived(bracket && user ? knockoutCurrentMatch(bracket, user.id) : undefined)

    const name = (userId: string) => accountName(detail.usernames, userId)

    function sideText(match: KnockoutMatch, side: KnockoutSide): string {
        if (side) return name(side)
        if (side === null) return match.round === 1 ? 'Bye' : 'Nobody'
        return 'To be decided'
    }

    function scoreText(match: KnockoutMatch, position: number): string {
        if (!match.games.length || match.decidedBy === 'bye') return ''
        const score = match.score[position]
        const whole = Math.floor(score)
        return score - whole === 0.5 ? `${whole || ''}½` : String(score)
    }

    function gameState(game: KnockoutMatchGame) {
        const tableId = game.table?.id
        const link = tableId ? gamesByTable.get(tableId) : undefined
        const label = knockoutGameName(game.game)
        if (game.winnerIds) {
            const winners = game.winnerIds.map(name).join(' and ')
            return {
                href: link && `/game/${link.gameId}`,
                state: 'finished',
                title: `${label}: ${game.winnerIds.length > 1 ? `shared by ${winners}` : `won by ${winners}`}`
            }
        }
        if (link)
            return { href: `/game/${link.gameId}`, state: 'active', title: `${label}: in progress` }
        return { href: undefined, state: 'waiting', title: `${label}: starting` }
    }

    const sideClass = (match: KnockoutMatch, side: KnockoutSide) => {
        const won = side && match.winnerId === side
        const lost = side && match.winnerId !== undefined && !won
        return [
            side && side === user?.id ? 'text-orange-700 dark:text-orange-300' : '',
            won ? 'font-semibold' : '',
            lost ? 'text-gray-400 dark:text-gray-500' : '',
            side ? '' : 'italic text-gray-400'
        ].join(' ')
    }
    const mine = (match: KnockoutMatch) => match.sides.some((side) => side && side === user?.id)
</script>

{#snippet chips(match: KnockoutMatch, long = false)}
    {#each match.games as game (game.game)}
        {@const state = gameState(game)}
        {#if state.href}
            <a href={state.href} title={state.title} class="game-chip {state.state}"
                >{long ? knockoutGameName(game.game) : knockoutGameLabel(game.game)}</a
            >
        {:else}
            <span title={state.title} class="game-chip {state.state}"
                >{long ? knockoutGameName(game.game) : knockoutGameLabel(game.game)}</span
            >
        {/if}
    {/each}
    {#if match.decidedBy === 'walkover'}<span class="text-[10px] text-gray-500">Walkover</span>{/if}
{/snippet}

{#snippet matchRow(match: KnockoutMatch, label: string, withChips = true)}
    <div
        class="match-row grid items-center gap-x-2 px-2.5 py-1.5 text-xs {mine(match)
            ? 'own-match'
            : ''} {match.decidedBy === 'bye' ? 'opacity-60' : ''}"
    >
        <span class="text-[10px] tabular-nums text-gray-500">{label}</span>
        <span class="truncate text-right {sideClass(match, match.sides[0])}"
            >{sideText(match, match.sides[0])}</span
        >
        <span class="text-center tabular-nums text-gray-500"
            >{scoreText(match, 0)}{match.games.length && match.decidedBy !== 'bye'
                ? '–'
                : ''}{scoreText(match, 1)}</span
        >
        <span class="truncate {sideClass(match, match.sides[1])}"
            >{sideText(match, match.sides[1])}</span
        >
        <span class="flex items-center justify-end gap-1 text-[10px] text-gray-500"
            >{#if withChips}{@render chips(match)}{/if}</span
        >
    </div>
{/snippet}

{#snippet matchCard(match: KnockoutMatch)}
    <li
        class="flex rounded-md border bg-gray-50 text-xs dark:bg-gray-800 {mine(match)
            ? 'border-orange-400/70'
            : 'border-gray-200 dark:border-gray-700'} {match.decidedBy === 'bye'
            ? 'opacity-60'
            : ''}"
    >
        <div class="min-w-0 flex-1">
            {#each match.sides as side, position (position)}
                <div
                    class="flex items-center justify-between gap-2 px-2 py-1 {position
                        ? 'border-t border-gray-200 dark:border-gray-700'
                        : ''}"
                >
                    <span class="truncate {sideClass(match, side)}" title={sideText(match, side)}
                        >{sideText(match, side)}</span
                    >
                    <span class="shrink-0 tabular-nums text-gray-500"
                        >{scoreText(match, position)}</span
                    >
                </div>
            {/each}
        </div>
        {#if match.games.length || match.decidedBy === 'walkover'}
            <div
                class="flex flex-col items-center justify-center gap-0.5 border-l border-gray-200 px-1 text-[9px] text-gray-500 dark:border-gray-700"
            >
                {@render chips(match)}
            </div>
        {/if}
    </li>
{/snippet}

<section aria-labelledby="bracket-heading">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="bracket-heading" class="font-tournament text-lg font-semibold">Bracket</h2>
        {#if bracket}<p class="text-xs text-gray-500">
                {stage?.dispatch?.finished.length ?? 0} games finished
            </p>{/if}
    </div>
    {#if bracket}
        {#if myMatch}
            <div
                class="mt-3 max-w-xl rounded-md border border-orange-400/70 bg-gray-50 dark:bg-gray-800"
            >
                <p class="px-2.5 pt-2 text-[11px] font-medium text-orange-700 dark:text-orange-300">
                    Your match · {knockoutMatchName(myMatch, rounds)}
                </p>
                {@render matchRow(myMatch, '', false)}
                {#if myMatch.games.length}
                    <p class="flex gap-1.5 px-2.5 pb-2 text-[11px]">
                        {@render chips(myMatch, true)}
                    </p>
                {/if}
            </div>
        {/if}
        {#if large}
            <div
                role="tablist"
                aria-label="Rounds"
                class="mt-3 flex gap-1 overflow-x-auto border-b border-gray-200 text-xs dark:border-gray-700"
            >
                {#each bracket.rounds as matches, index (index)}
                    <button
                        role="tab"
                        aria-selected={view === index + 1}
                        class="round-tab"
                        onclick={() => (chosen = index + 1)}
                        >{knockoutRoundName(index + 1, rounds)}
                        <span class="text-gray-500">{matches.length}</span></button
                    >
                {/each}
                <button
                    role="tab"
                    aria-selected={view === 'all'}
                    class="round-tab ml-auto"
                    onclick={() => (chosen = 'all')}>Whole bracket</button
                >
            </div>
        {/if}
        {#if large && view !== 'all'}
            <div
                class="mt-2 divide-y divide-gray-200/70 rounded-md bg-gray-50 dark:divide-gray-700/50 dark:bg-gray-800"
            >
                {#each bracket.rounds[view - 1] as match (match.index)}
                    {@render matchRow(match, String(match.index + 1))}
                {/each}
            </div>
        {:else}
            <div class="mt-3 overflow-x-auto pb-2">
                <div class="flex min-w-max gap-4">
                    {#each bracket.rounds as matches, roundIndex (roundIndex)}
                        <div class="flex w-48 flex-col">
                            <h3 class="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                                {knockoutRoundName(roundIndex + 1, rounds)}
                            </h3>
                            <ol class="flex flex-1 flex-col justify-around gap-2">
                                {#each matches as match (match.index)}
                                    {@render matchCard(match)}
                                {/each}
                            </ol>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
        <p class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            G1 and G2 are played at the same time, one from each side. D is the decider.
        </p>
    {:else if !stage?.scheduleId}
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
            The draw is made when registration closes.
        </p>
    {/if}
</section>

<style>
    .match-row {
        grid-template-columns: 1.5rem minmax(0, 1fr) 3rem minmax(0, 1fr) 5.5rem;
    }
    .match-row.own-match {
        box-shadow: inset 2px 0 var(--color-orange-400);
    }
    .round-tab {
        white-space: nowrap;
        padding: 0.375rem 0.625rem;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
        color: var(--color-gray-500);
    }
    .round-tab[aria-selected='true'] {
        border-bottom-color: var(--color-blue-500);
        color: inherit;
    }
    .round-tab:focus-visible {
        outline: 2px solid var(--color-blue-400);
        outline-offset: -2px;
    }
    .game-chip {
        border-radius: 0.25rem;
        border: 1px solid var(--color-gray-300);
        padding: 0 0.3rem;
        line-height: 1rem;
    }
    :global(.dark) .game-chip {
        border-color: var(--color-gray-600);
    }
    .game-chip.active {
        border-color: var(--color-blue-500);
        color: var(--color-blue-600);
    }
    :global(.dark) .game-chip.active {
        color: var(--color-blue-300);
    }
    .game-chip.waiting {
        border-style: dashed;
    }
    a.game-chip:hover {
        border-color: var(--color-gray-500);
    }
    a.game-chip:focus-visible {
        outline: 2px solid var(--color-blue-400);
        outline-offset: 1px;
    }
</style>
