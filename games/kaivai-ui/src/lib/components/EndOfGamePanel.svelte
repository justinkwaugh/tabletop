<script lang="ts">
    import { getContext } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import { fade } from 'svelte/transition'
    import { PlayerName } from '@tabletop/frontend-components'

    let gameSession = getContext('gameSession') as KaivaiGameSession
    let winner = $derived(gameSession.gameState.winningPlayerIds[0])
</script>

<div
    transition:fade={{ duration: 75 }}
    class="mb-2 rounded-lg px-2 pt-2 pb-4 text-center flex flex-row flex-wrap justify-center items-center"
>
    <h1 class="text-lg sm:text-xl uppercase kaivai-font">
        <PlayerName playerId={winner} />
        won with a score of {gameSession.gameState.getPlayerState(winner ?? 'anyone')?.score}
    </h1>
</div>
