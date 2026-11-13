<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import SeatDot from './SeatDot.svelte'

    let { playerId, text }: { playerId: string; text: string } = $props()

    const gameSession = getGameSession()
</script>

<span
    class="inline-flex items-center gap-1.5 rounded-full border border-rtr-line bg-rtr-panel-raised px-2 py-0.5 text-sm font-medium text-rtr-ink"
>
    <SeatDot {playerId} />
    {gameSession.getPlayerName(playerId)}
    {text}
</span>
