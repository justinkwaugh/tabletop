<script lang="ts">
    import { setContext, getContext, type Component } from 'svelte'
    import type { GameSession } from '@tabletop/frontend-components'
    import { onMount } from 'svelte'
    import type { AppContext } from '$lib/stores/appContext.svelte'
    import AdminPanel from '$lib/components/AdminPanel.svelte'

    let { data }: { data: { gameSession: GameSession } } = $props()
    setContext('gameSession', data.gameSession)

    let { gameService, notificationService, authorizationService } = getContext(
        'appContext'
    ) as AppContext
    let Table: Component | null = $state(null)

    onMount(() => {
        const gameSession = data.gameSession
        gameService.currentGameSession = gameSession
        gameSession.definition.getTableComponent().then((tableComponent) => {
            Table = tableComponent
        })

        setTimeout(() => {
            notificationService.showPrompt()
        }, 2000)

        data.gameSession.listenToGame()

        return () => {
            gameSession.stopListeningToGame()
            gameService.currentGameSession = undefined
        }
    })

    function onKeyDown(event: KeyboardEvent) {
        if (event.key === 'ArrowUp') {
            event.preventDefault()
            data.gameSession.goToMyNextTurn()
        } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            data.gameSession.goToMyPreviousTurn()
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault()
            data.gameSession.stepBackward()
        } else if (event.key === 'ArrowRight') {
            event.preventDefault()
            data.gameSession.stepForward()
        }
    }
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="flex flex-col w-screen overflow-auto">
    {#if authorizationService.actAsAdmin}
        <AdminPanel />
    {/if}
    <Table />
</div>
