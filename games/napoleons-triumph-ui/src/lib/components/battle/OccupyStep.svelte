<script lang="ts">
    import type { OccupationStage } from '$lib/model/battleStage.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AttackerPicker from './AttackerPicker.svelte'

    let { stage }: { stage: OccupationStage } = $props()

    const gameSession = getGameSession()
</script>

<div class="nt-battle-prompt">
    The defender has given ground. Name the units that made the threat; they move into the locale.
    {#if stage.roadOrders || stage.byRoad}
        Cavalry that rides in by road may ride on or threaten again, and is shown when its move
        ends.
    {/if}
</div>
<AttackerPicker {stage} />
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
            >Show the guns and hold them in place</button
        >
    {/if}
</div>
