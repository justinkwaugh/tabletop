<script lang="ts">
    import { setContext, getContext, type Component } from 'svelte'
    import { GameSession } from '@tabletop/frontend-components'
    import { onMount } from 'svelte'
    import type { AppContext } from '$lib/stores/appContext.svelte'
    import AdminPanel from '$lib/components/AdminPanel.svelte'
    import type { GameState, HydratedGameState } from '@tabletop/common'

    let { data }: { data: { gameSession: GameSession<GameState, HydratedGameState> } } = $props()
    setContext('gameSession', data.gameSession)

    let { gameService, notificationService, authorizationService, chatService } = getContext(
        'appContext'
    ) as AppContext
    let Table: Component | null = $state(null)

    onMount(() => {
        const gameSession = data.gameSession
        gameService.currentGameSession = gameSession
        gameSession.definition.getTableComponent().then((tableComponent: Component) => {
            Table = tableComponent
        })

        setTimeout(() => {
            notificationService.showPrompt()
        }, 2000)

        gameSession.listenToGame()
        return () => {
            gameSession.stopListeningToGame()
            gameService.currentGameSession = undefined
            setContext('gameSession', undefined)
            chatService.clear()
        }
    })

    function onKeyDown(event: KeyboardEvent) {
        if (
            event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLTextAreaElement
        ) {
            return
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault()
            data.gameSession.goToMyNextTurn()
        } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            data.gameSession.goToMyPreviousTurn()
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault()
            data.gameSession.goToPreviousAction()
        } else if (event.key === 'ArrowRight') {
            event.preventDefault()
            data.gameSession.goToNextAction()
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
