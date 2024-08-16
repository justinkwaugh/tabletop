<script lang="ts">
    import { setContext, getContext, type Component } from 'svelte'
    import type { GameSession } from '@tabletop/frontend-components'
    import { onMount } from 'svelte'
    import type { AppContext } from '$lib/stores/appContext.svelte'

    let { data }: { data: { gameSession: GameSession } } = $props()
    setContext('gameSession', data.gameSession)

    let { gameService, notificationService } = getContext('appContext') as AppContext
    let table: Component | null = $state(null)

    const visibilityChangeHandler = async () => {
        switch (document.visibilityState) {
            case 'visible':
                console.log('visible')
                data.gameSession.listenToGame()
                break
            case 'hidden':
                console.log('not visible')
                data.gameSession.stopListeningToGame()
                break
            default:
                break
        }
    }

    onMount(() => {
        const gameSession = data.gameSession
        gameService.currentGameSession = gameSession
        gameSession.definition.getTableComponent().then((tableComponent) => {
            table = tableComponent
        })

        setTimeout(() => {
            notificationService.showPrompt()
        }, 2000)

        document.addEventListener('visibilitychange', visibilityChangeHandler)
        if (document.visibilityState === 'visible') {
            data.gameSession.listenToGame()
        }

        return () => {
            document.removeEventListener('visibilitychange', visibilityChangeHandler)
            gameSession.stopListeningToGame()
            gameService.currentGameSession = undefined
        }
    })
</script>

<div class="flex w-screen overflow-auto">
    <svelte:component this={table} />
</div>
