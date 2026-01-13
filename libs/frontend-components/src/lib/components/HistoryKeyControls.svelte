<script lang="ts">
    import { getGameSession } from '$lib/model/gameSessionContext.js'

    let gameSession = getGameSession()

    function onKeyDown(event: KeyboardEvent) {
        if (
            !gameSession ||
            event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLTextAreaElement
        ) {
            return
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault()
            if (gameSession.isBusy()) {
                return
            }
            if (gameSession.myPlayer) {
                gameSession.history.goToPlayersNextTurn(gameSession.myPlayer.id)
            }
        } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            if (gameSession.isBusy()) {
                return
            }
            if (gameSession.myPlayer) {
                gameSession.history.goToPlayersPreviousTurn(gameSession.myPlayer.id)
            }
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault()
            if (gameSession.isBusy()) {
                return
            }
            gameSession.history.goToPreviousAction()
        } else if (event.key === 'ArrowRight') {
            event.preventDefault()
            if (gameSession.isBusy()) {
                return
            }
            gameSession.history.goToNextAction(event.shiftKey)
        }
    }
</script>

<svelte:window onkeydown={onKeyDown} />
