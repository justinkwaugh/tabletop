<script lang="ts">
    import { onMount } from 'svelte'
    import { flip } from 'svelte/animate'
    import { prefersReducedMotion } from 'svelte/motion'
    import type { TitleActivity } from '@tabletop/common'
    import { currentDashboardGames } from '$lib/utils/dashboardGames'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import GameCard from '$lib/components/GameCard.svelte'
    import TitleSection from '$lib/components/TitleSection.svelte'

    const PREVIEW_COUNT = 10

    let { titleId, oncreate }: { titleId: string; oncreate: () => void } = $props()
    const { gameService, authorizationService, api } = getAppContext()
    type ActivityScope = keyof TitleActivity
    type Scope = 'mine' | 'open' | ActivityScope
    let states = $state<Record<Scope, 'loading' | 'ready' | 'error' | 'unavailable'>>({
        mine: 'loading',
        open: 'loading',
        inProgress: 'loading',
        recentlyFinished: 'loading'
    })
    let activity = $state<TitleActivity>({ inProgress: [], recentlyFinished: [] })
    let expanded = $state<Record<ActivityScope, boolean>>({
        inProgress: false,
        recentlyFinished: false
    })
    let myGames = $derived(
        currentDashboardGames(
            gameService.activeGames,
            gameService.waitingGames,
            authorizationService.getSessionUser()?.id
        ).filter((game) => game.typeId === titleId)
    )
    let openGames = $derived(gameService.openGamesByTitleId.get(titleId) ?? [])
    const sections: { scope: Scope; title: string; empty: string }[] = [
        { scope: 'mine', title: 'Your games', empty: 'Your games of this title will appear here.' },
        {
            scope: 'open',
            title: 'Open games',
            empty: 'No open tables right now. Start one and invite others to join.'
        },
        {
            scope: 'inProgress',
            title: 'In progress',
            empty: 'No public games of this title are being played right now.'
        },
        {
            scope: 'recentlyFinished',
            title: 'Recently finished',
            empty: 'No public games of this title have finished yet.'
        }
    ]

    function gamesFor(scope: Scope) {
        if (scope === 'mine') return myGames
        if (scope === 'open') return openGames
        return expanded[scope] ? activity[scope] : activity[scope].slice(0, PREVIEW_COUNT)
    }

    function hiddenCount(scope: Scope): number {
        if (scope === 'mine' || scope === 'open' || expanded[scope]) return 0
        return Math.max(activity[scope].length - PREVIEW_COUNT, 0)
    }

    function showAll(scope: Scope) {
        if (scope === 'inProgress' || scope === 'recentlyFinished') expanded[scope] = true
    }

    function count(scope: Scope): number {
        if (scope === 'mine') return myGames.length
        if (scope === 'open') return openGames.length
        return activity[scope].length
    }

    async function load(scope: Scope) {
        if (scope === 'inProgress' || scope === 'recentlyFinished') return loadActivity()
        states[scope] = 'loading'
        try {
            if (scope === 'mine') await gameService.loadGames()
            else await gameService.loadOpenGames(titleId)
            states[scope] = 'ready'
        } catch {
            states[scope] = 'error'
        }
    }

    async function loadActivity() {
        states.inProgress = states.recentlyFinished = 'loading'
        try {
            activity = await api.getTitleActivity(titleId)
            states.inProgress = states.recentlyFinished = 'ready'
        } catch (error) {
            states.inProgress = states.recentlyFinished =
                error instanceof Error && error.name === 'TitleActivityUnavailable'
                    ? 'unavailable'
                    : 'error'
        }
    }

    onMount(() => {
        void refresh()
        void loadActivity()
    })

    export async function refresh() {
        await Promise.all([load('mine'), load('open')])
    }
</script>

<div class="game-sections">
    {#each sections as section (section.scope)}
        {@const games = gamesFor(section.scope)}
        {@const hidden = hiddenCount(section.scope)}
        <TitleSection
            title={section.title}
            count={states[section.scope] === 'ready' ? count(section.scope) : undefined}
        >
            {#if states[section.scope] === 'loading'}
                <p class="empty" role="status">Loading games…</p>
            {:else if states[section.scope] === 'error'}
                <div class="empty" role="alert">
                    <p>These games couldn’t load.</p>
                    <button onclick={() => load(section.scope)}>Try again</button>
                </div>
            {:else if states[section.scope] === 'unavailable'}
                <div class="empty" role="status">
                    <p>These games are temporarily unavailable.</p>
                    <button onclick={() => load(section.scope)}>Try again</button>
                </div>
            {:else if games.length === 0}
                <div class="empty" class:compact={section.scope === 'mine'}>
                    <p>{section.empty}</p>
                    {#if section.scope === 'open'}<button onclick={oncreate}>Start a game →</button
                        >{/if}
                </div>
            {:else}
                <div class="game-list">
                    {#each games as game (game.id)}
                        <div
                            class="min-w-0"
                            animate:flip={{ duration: prefersReducedMotion.current ? 0 : 250 }}
                        >
                            <GameCard
                                {game}
                                class="mx-0 mb-0 p-4 min-w-0 w-full max-w-none border border-gray-700/60 dark:border-gray-700/60 bg-gray-800/50 dark:bg-gray-800/50 rounded-xl"
                            />
                        </div>
                    {/each}
                </div>
                {#if hidden > 0}
                    <button class="show-more" onclick={() => showAll(section.scope)}
                        >Show {hidden} more</button
                    >
                {/if}
            {/if}
        </TitleSection>
    {/each}
</div>

<style>
    .game-sections {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 32px;
    }
    .game-list {
        display: grid;
        gap: 12px;
    }
    .empty {
        min-height: 150px;
        padding: 28px;
        border: 1px solid var(--color-gray-800);
        background: #1e293b40;
        border-radius: 12px;
        color: var(--color-gray-400);
        font-size: 14px;
        line-height: 1.6;
    }
    .empty button {
        margin-top: 14px;
        color: var(--color-blue-300);
        font-weight: 500;
    }
    .empty.compact {
        min-height: 0;
    }
    .empty button:hover,
    .show-more:hover {
        text-decoration: underline;
    }
    .show-more {
        margin-top: 14px;
        color: var(--color-blue-300);
        font-size: 14px;
        font-weight: 500;
    }
    @media (max-width: 800px) {
        .game-sections {
            grid-template-columns: 1fr;
        }
    }
</style>
