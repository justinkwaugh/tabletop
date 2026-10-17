<script lang="ts">
    import type { OccupationStage } from '$lib/model/battleStage.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AttackerPicker from './AttackerPicker.svelte'

    let { stage, folded = false }: { stage: OccupationStage; folded?: boolean } = $props()

    const gameSession = getGameSession()
</script>

<div class="nt-battle-prompt">
    {#if folded}
        The defender has retreated. Tap the units that made the threat on the map; they move into
        the locale.
    {:else}
        The defender has retreated. Name the units that made the threat; they move into the locale.
    {/if}
    {#if stage.roadOrders || stage.byRoad}
        Cavalry that rides in by road may ride on or threaten again, and is shown when its move
        ends.
    {/if}
</div>
<AttackerPicker {stage} {folded} />
<div class="flex flex-wrap gap-2 pt-1">
    <button
        type="button"
        class="nt-plain-button"
        disabled={!stage.mayMoveIn}
        onclick={() => gameSession.moveIn()}
        >{stage.byRoad ? 'Ride into the locale' : 'Move into the locale'}</button
    >
    {#if stage.roadOrders}
        <button type="button" class="nt-plain-button" onclick={() => gameSession.rideIn()}
            >Ride in by road</button
        >
    {/if}
    {#if stage.gunsMayStay}
        <button type="button" class="nt-plain-button" onclick={() => gameSession.holdGuns()}
            >Show the artillery and hold it in place</button
        >
    {/if}
</div>
