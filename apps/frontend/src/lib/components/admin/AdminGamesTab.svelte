<script lang="ts">
    import type { Game } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import DashboardGameList from '$lib/components/DashboardGameList.svelte'

    const { api, libraryService } = getAppContext()

    let titles = $derived(
        Object.values(libraryService.titlesById).toSorted((a, b) =>
            a.info.metadata.name.localeCompare(b.info.metadata.name)
        )
    )
    let titleId = $state('')
    let games = $state<Game[]>([])
    let busy = $state(false)
    let error = $state('')
    let request = 0

    async function load(selectedTitleId: string) {
        titleId = selectedTitleId
        const current = ++request
        games = []
        if (!selectedTitleId) return
        busy = true
        error = ''
        try {
            const results = await api.getActiveGamesForTitle(selectedTitleId)
            if (current !== request) return
            games = results.toSorted(
                (a, b) => (b.lastActionAt?.getTime() ?? 0) - (a.lastActionAt?.getTime() ?? 0)
            )
        } catch (failure) {
            if (current === request)
                error = failure instanceof Error ? failure.message : 'Could not load games'
        } finally {
            if (current === request) busy = false
        }
    }

    function removeGame(game: Game) {
        games = games.filter((other) => other.id !== game.id)
    }
</script>

<label class="flex flex-col gap-1 text-sm sm:max-w-md">
    <span class="text-gray-600 dark:text-gray-300">Game</span>
    <select
        value={titleId}
        onchange={(event) => void load(event.currentTarget.value)}
        class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
    >
        <option value="">Choose a game</option>
        {#each titles as title (title.info.id)}
            <option value={title.info.id}>{title.info.metadata.name}</option>
        {/each}
    </select>
</label>
{#if error}<p role="alert" class="mt-4 text-sm text-red-600 dark:text-red-300">{error}</p>{/if}
<div class="mt-5" aria-busy={busy}>
    {#if busy}
        <div class="flex justify-center py-10" role="status">
            <span class="sr-only">Loading games</span>
            <span
                aria-hidden="true"
                class="size-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600 dark:border-gray-700 dark:border-t-gray-400 motion-reduce:animate-none"
            ></span>
        </div>
    {:else if titleId && !games.length && !error}
        <p class="text-sm text-gray-500 dark:text-gray-400">No active games for this title.</p>
    {:else if games.length}
        <p class="mb-3 text-sm text-gray-500 dark:text-gray-400">{games.length} active games</p>
        <DashboardGameList {games} ondelete={removeGame} />
    {/if}
</div>
