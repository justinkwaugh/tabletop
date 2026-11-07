<script lang="ts">
    import PlayerState from '$lib/components/PlayerState.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Scrim from './Scrim.svelte'

    /** One seat at reading size, from the displayed state, so it works in History View. */
    let { playerId, onClose }: { playerId: string; onClose: () => void } = $props()

    const gameSession = getGameSession()
</script>

<Scrim label="{gameSession.getPlayerName(playerId)}'s seat" layer="seat" {onClose}>
    <div class="open-seat pt-10" data-open-seat={playerId}>
        <PlayerState {playerId} reading />
    </div>
</Scrim>

<style>
    .open-seat {
        width: min(600px, calc(100vw - 32px));
    }
</style>
