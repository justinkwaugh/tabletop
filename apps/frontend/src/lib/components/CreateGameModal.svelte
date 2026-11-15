<script lang="ts">
    import { goto } from '$app/navigation'
    import {
        GameStorage,
        type Game,
        type GameState,
        type HydratedGameState
    } from '@tabletop/common'
    import type { GameUiDefinition } from '@tabletop/frontend-components'
    import { Modal } from 'flowbite-svelte'
    import CreateGameSteps from '$lib/components/CreateGameSteps.svelte'
    import type { TitleGameCounts } from '$lib/utils/seriesLobby'

    let {
        open = $bindable(),
        titles,
        counts,
        initialTitleId,
        oncreated
    }: {
        open: boolean
        titles: GameUiDefinition<GameState, HydratedGameState>[]
        counts?: Map<string, TitleGameCounts>
        initialTitleId?: string
        oncreated: (game: Game) => void
    } = $props()

    async function saved(game: Game) {
        open = false
        if (game.storage === GameStorage.Local) await goto(`/game/${game.id}`)
        else oncreated(game)
    }
</script>

<Modal
    bind:open
    size="xs"
    outsideclose
    class="backdrop:bg-black/70 dark:bg-gray-900 border border-highlight-border dark:border-highlight-border divide-y-0 max-sm:mt-auto max-sm:mb-0 max-sm:mx-0 max-sm:max-w-none max-sm:h-[calc(100dvh-1.75rem)] max-sm:max-h-none max-sm:rounded-b-none max-sm:border-b-0"
    classes={{ body: 'flex flex-col min-h-0 flex-1' }}
>
    <CreateGameSteps
        {titles}
        {counts}
        {initialTitleId}
        oncancel={() => (open = false)}
        onsave={saved}
    />
</Modal>
