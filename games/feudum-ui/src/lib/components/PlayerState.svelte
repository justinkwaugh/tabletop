<script lang="ts">
    import SeatPanel from '$lib/components/seat/SeatPanel.svelte'
    import { getTableLayers } from '$lib/components/table/tableLayersContext.js'
    import { seatPaint } from '$lib/model/seatPaint.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    /**
     * One seat from the session's one derivation of it, in the column or, `reading`, as the open
     * seat. The ribbon opens the seat; on the open seat it closes it.
     */
    let { playerId, reading = false }: { playerId: string; reading?: boolean } = $props()

    const gameSession = getGameSession()
    const layers = getTableLayers()

    let view = $derived(gameSession.seatPanel(playerId))
    let name = $derived(gameSession.getPlayerName(playerId))
    let paint = $derived(seatPaint(gameSession.colors, playerId, name.charAt(0).toUpperCase()))

    function onRibbon() {
        if (reading) {
            layers?.closeSeatOrStack()
        } else {
            layers?.openSeat(playerId)
        }
    }
</script>

<SeatPanel
    {view}
    {paint}
    {reading}
    ribbonLabel="{reading ? 'Close' : 'Open'} {name}'s seat"
    {onRibbon}
/>
{#if gameSession.showDebug}
    <div class="text-xs text-feudum-text-muted">id: {playerId}</div>
{/if}
