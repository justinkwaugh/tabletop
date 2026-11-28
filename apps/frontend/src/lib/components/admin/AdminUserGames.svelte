<script lang="ts">
    import { GameStatus, type Game, type User } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { getLocale } from '$lib/paraglide/runtime'
    import { adminGameSeatNote, adminGameSeatsLabel } from '$lib/utils/adminUserGames'
    import { compareFollowedGames, lastGameActivity } from '$lib/utils/dashboardGames'
    import { LatestRequest } from '$lib/utils/latestRequest'

    let { user }: { user: User } = $props()

    const { api, libraryService } = getAppContext()
    const requests = new LatestRequest()

    const statusLabels: Record<GameStatus, string> = {
        [GameStatus.WaitingForPlayers]: 'waiting for players',
        [GameStatus.WaitingToStart]: 'waiting to start',
        [GameStatus.Started]: 'in play',
        [GameStatus.Finished]: 'finished',
        [GameStatus.Deleted]: 'deleted',
        [GameStatus.Archived]: 'archived'
    }

    let games = $state<Game[]>([])
    let busy = $state(false)
    let error = $state('')

    const activeCount = $derived(games.filter((game) => game.status !== GameStatus.Finished).length)

    $effect(() => {
        void load(user.id)
    })

    async function load(userId: string) {
        const current = requests.begin()
        games = []
        error = ''
        busy = true
        try {
            const results = await api.getUserGamesAsAdministrator(userId)
            if (current()) games = results.toSorted(compareFollowedGames)
        } catch (failure) {
            if (current())
                error = failure instanceof Error ? failure.message : 'Could not load games'
        } finally {
            if (current()) busy = false
        }
    }

    function activityDate(game: Game): string {
        return lastGameActivity(game).toLocaleDateString(getLocale(), {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    }
</script>

<section
    class="rounded-xl border border-gray-200 p-4 dark:border-gray-700/60"
    aria-label={`Games for ${user.username ?? user.id}`}
    aria-busy={busy}
>
    <h3 class="text-sm font-medium">
        Games
        {#if !busy && !error}
            <span class="font-normal text-gray-500 dark:text-gray-400"
                >· {activeCount} active, {games.length - activeCount} finished</span
            >
        {/if}
    </h3>
    {#if error}
        <p role="alert" class="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p>
    {:else if busy}
        <p class="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
    {:else if !games.length}
        <p class="mt-3 text-sm text-gray-500 dark:text-gray-400">Not in any games.</p>
    {:else}
        <ul class="mt-3 grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
            {#each games as game (game.id)}
                {@const note = adminGameSeatNote(game, user.id)}
                <li class="min-w-0">
                    <a
                        href={`/game/${game.id}`}
                        class="block truncate font-medium text-blue-700 hover:underline dark:text-blue-400"
                        >{game.name}</a
                    >
                    <span class="block truncate text-xs text-gray-500 dark:text-gray-400">
                        {libraryService.getNameForTitle(game.typeId)} · {statusLabels[
                            game.status
                        ]}{note ? ` · ${note}` : ''}
                        · {adminGameSeatsLabel(game)}{game.hotseat ? ' · hotseat' : ''} ·
                        {activityDate(game)}
                    </span>
                </li>
            {/each}
        </ul>
    {/if}
</section>
