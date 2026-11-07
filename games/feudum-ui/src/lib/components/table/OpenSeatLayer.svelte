<script lang="ts">
    import PlayerState from '$lib/components/PlayerState.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Scrim from './Scrim.svelte'

    /** One seat at reading size, from the displayed state, so it works in History View. */
    let { playerId, onClose }: { playerId: string; onClose: () => void } = $props()

    const gameSession = getGameSession()

    let player = $derived(gameSession.game.players.find(({ id }) => id === playerId))
    let playerState = $derived(
        gameSession.gameState.players.find((row) => row.playerId === playerId)
    )
</script>

<Scrim label="{gameSession.getPlayerName(playerId)}'s seat" layer="seat" {onClose}>
    <div
        class="rounded-lg bg-feudum-surface-raised text-feudum-text p-6 pt-10 min-w-[320px]"
        data-open-seat={playerId}
    >
        {#if player && playerState}
            <PlayerState {player} {playerState} />
        {/if}
    </div>
</Scrim>
