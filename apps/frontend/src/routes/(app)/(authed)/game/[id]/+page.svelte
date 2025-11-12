<script lang="ts">
    import { setContext, getContext, type Component } from 'svelte'
    import { GameSession, GameSessionMode, HotseatPanel } from '@tabletop/frontend-components'
    import { onMount } from 'svelte'
    import type { AppContext } from '$lib/stores/appContext.svelte'
    import AdminPanel from '$lib/components/AdminPanel.svelte'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import ExplorationPanel from '$lib/components/ExplorationPanel.svelte'

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

        if (!gameSession.game.hotseat) {
            setTimeout(() => {
                notificationService.showPrompt()
            }, 2000)

            gameSession.listenToGame()
        }
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
            if (data.gameSession.myPlayer) {
                data.gameSession.history.goToPlayersNextTurn(data.gameSession.myPlayer.id)
            }
        } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            if (data.gameSession.myPlayer) {
                data.gameSession.history.goToPlayersPreviousTurn(data.gameSession.myPlayer.id)
            }
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault()
            data.gameSession.history.goToPreviousAction()
        } else if (event.key === 'ArrowRight') {
            event.preventDefault()
            data.gameSession.history.goToNextAction()
        }
    }
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="flex flex-col w-screen overflow-auto">
    {#if authorizationService.actAsAdmin}
        <AdminPanel />
    {/if}
    {#if data.gameSession.mode === GameSessionMode.Explore}
        <ExplorationPanel />
    {:else if data.gameSession.game.hotseat}
        <HotseatPanel />
    {/if}
    <Table />
</div>
