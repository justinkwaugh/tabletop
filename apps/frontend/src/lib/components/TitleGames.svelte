<script lang="ts">
    import { onMount } from 'svelte'
    import { flip } from 'svelte/animate'
    import { prefersReducedMotion } from 'svelte/motion'
    import { compareGameInvitations } from '$lib/utils/gameInvitation'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import GameCard from '$lib/components/GameCard.svelte'
    import TitleSection from '$lib/components/TitleSection.svelte'

    let { titleId, oncreate }: { titleId: string; oncreate: () => void } = $props()
    const { gameService, authorizationService } = getAppContext()
    type Scope = 'mine' | 'open'
    let states = $state<Record<Scope, 'loading' | 'ready' | 'error'>>({
        mine: 'loading',
        open: 'loading'
    })
    let myGames = $derived(
        [...gameService.activeGames, ...gameService.waitingGames]
            .filter((game) => game.typeId === titleId)
            .toSorted((a, b) =>
                compareGameInvitations(a, b, authorizationService.getSessionUser()?.id)
            )
    )
    let openGames = $derived(
        (gameService.openGamesByTitleId.get(titleId) ?? []).filter((game) => {
            const user = authorizationService.getSessionUser()
            return (
                game.ownerId !== user?.id &&
                !game.players.some((player) => player.userId === user?.id)
            )
        })
    )
    const sections: { scope: Scope; title: string; empty: string }[] = [
        { scope: 'mine', title: 'Your games', empty: 'Your games of this title will appear here.' },
        {
            scope: 'open',
            title: 'Open games',
            empty: 'No open tables right now. Start one and invite others to join.'
        }
    ]

    async function load(scope: Scope) {
        states[scope] = 'loading'
        try {
            if (scope === 'mine') await gameService.loadGames()
            else await gameService.loadOpenGames(titleId)
            states[scope] = 'ready'
        } catch {
            states[scope] = 'error'
        }
    }

    onMount(() => {
        void refresh()
    })

    export async function refresh() {
        await Promise.all([load('mine'), load('open')])
    }
</script>

<div class="game-sections">
    {#each sections as section (section.scope)}
        {@const games = section.scope === 'mine' ? myGames : openGames}
        <TitleSection
            title={section.title}
            count={states[section.scope] === 'ready' ? games.length : undefined}
        >
            {#if states[section.scope] === 'loading'}
                <p class="empty" role="status">Loading games…</p>
            {:else if states[section.scope] === 'error'}
                <div class="empty" role="alert">
                    <p>These games couldn’t load.</p>
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
    .empty button:hover {
        text-decoration: underline;
    }
    @media (max-width: 800px) {
        .game-sections {
            grid-template-columns: 1fr;
        }
    }
</style>
