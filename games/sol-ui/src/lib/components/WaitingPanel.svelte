<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import { fade } from 'svelte/transition'

    let gameSession = getContext('gameSession') as SolGameSession

    let waitingText = $derived.by(() => {
        if (gameSession.activePlayers.length === 0) {
            return ''
        }

        const activePlayer = gameSession.game.players.find(
            (player) => player.id === gameSession.activePlayers[0].id
        )

        if (!activePlayer) {
            return ''
        }

        if (gameSession.isDrawingCards) {
            return `WAITING FOR ${activePlayer.name} TO DRAW ${gameSession.myPlayerState?.drawnCards.length ?? 0} CARD${(gameSession.myPlayerState?.drawnCards.length ?? 1) === 1 ? '' : 'S'}`
        } else if (
            gameSession.isActivating &&
            gameSession.myPlayerState &&
            gameSession.myPlayerState.playerId !== gameSession.turnPlayer?.playerId
        ) {
            return 'WAITING FOR ' + activePlayer.name + ' TO DECIDE ABOUT THE BONUS'
        } else {
            return 'WAITING FOR ' + activePlayer.name
        }
    })
</script>

<div
    in:fade={{ duration: 300, delay: 100 }}
    out:fade={{ duration: 100 }}
    class="ms-3 py-2 flex flex-row justify-center items-center h-[50px] {waitingText
        ? ''
        : 'pointer-events-none'}"
>
    <div class="me-2">{waitingText}</div>
</div>
