<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'

    import Header from './Header.svelte'
    import { fade } from 'svelte/transition'

    let gameSession = getContext('gameSession') as SolGameSession

    let waitingText = $derived.by(() => {
        if (
            !gameSession.myPlayerState ||
            gameSession.myPlayerState.playerId !== gameSession.turnPlayer?.playerId ||
            gameSession.activePlayers.length === 0
        ) {
            return ''
        }

        const activePlayer = gameSession.game.players.find(
            (player) => player.id === gameSession.activePlayers[0].id
        )

        if (activePlayer && gameSession.isActivating) {
            return 'WAITING FOR ' + activePlayer.name + ' TO DECIDE ABOUT THE BONUS'
        }

        return ''
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
