<script lang="ts">
    import PlayerState from '$lib/components/PlayerState.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Scrim from './Scrim.svelte'

    /** One seat at reading size, from the displayed state, so it works in History View. */
    let { playerId, onClose, sheet }: { playerId: string; onClose: () => void; sheet?: number } =
        $props()

    const gameSession = getGameSession()
</script>

<Scrim label="{gameSession.getPlayerName(playerId)}'s seat" layer="seat" {onClose} {sheet}>
    <div class="open-seat pt-10" class:on-sheet={sheet !== undefined} data-open-seat={playerId}>
        <PlayerState {playerId} reading />
    </div>
</Scrim>

<style>
    .open-seat {
        width: min(600px, calc(100vw - 32px));
    }

    .open-seat.on-sheet {
        width: 100%;
        padding-inline: 8px;
    }
</style>
