<script lang="ts">
    import type { OccupationStage } from '$lib/model/battleStage.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { COMMAND_NAMES } from '$lib/model/moveCommands.js'
    import AttackerPicker from './AttackerPicker.svelte'

    let { stage, folded = false }: { stage: OccupationStage; folded?: boolean } = $props()

    const gameSession = getGameSession()

    const rideNeeds = $derived(
        !stage.roadOrders && stage.roadCommands.length > 0
            ? `Riding in by road takes a ${stage.roadCommands.map((kind) => COMMAND_NAMES[kind]).join(' or a ')}.`
            : undefined
    )
</script>

<div class="nt-battle-prompt">
    {#if folded}
        The defender has retreated. Tap the units that made the threat on the map; they move into
        the locale.
    {:else}
        The defender has retreated. Name the units that made the threat; they move into the locale.
    {/if}
    {#if stage.roadCommands.length > 0 || stage.byRoad}
        Cavalry that rides in by road may ride on or threaten again, and is shown when its move
        ends.
    {/if}
</div>
<AttackerPicker {stage} {folded} />
{#if rideNeeds}
    <div class="nt-battle-prompt">{rideNeeds}</div>
{/if}
<div class="flex flex-wrap gap-2 pt-1">
    <button
        type="button"
        class="nt-plain-button"
        disabled={!stage.mayMoveIn}
        onclick={() => gameSession.moveIn()}
        >{stage.byRoad ? 'Ride into the locale' : 'Move into the locale'}</button
    >
    {#if stage.roadCommands.length > 0}
        <button
            type="button"
            class="nt-plain-button"
            disabled={!stage.roadOrders}
            onclick={() => gameSession.rideIn()}>Ride in by road</button
        >
    {/if}
    {#if stage.gunsMayStay}
        <button type="button" class="nt-plain-button" onclick={() => gameSession.holdGuns()}
            >Show the artillery and hold it in place</button
        >
    {/if}
</div>
