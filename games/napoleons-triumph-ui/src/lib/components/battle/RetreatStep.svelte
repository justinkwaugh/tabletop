<script lang="ts">
    import { commanderDefinition } from '@tabletop/napoleons-triumph'
    import UnitTile from '$lib/components/UnitTile.svelte'
    import type { RetreatStage } from '$lib/model/battleStage.js'
    import { RetreatFate, type RetreatingUnit } from '$lib/model/retreatPlan.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { stage }: { stage: RetreatStage } = $props()

    const gameSession = getGameSession()
    const plan = $derived(stage.plan)

    function fateOf({ fate, loss, destination }: RetreatingUnit): string {
        if (fate === RetreatFate.GunsLost) {
            return 'lost'
        }
        if (fate === RetreatFate.Eliminated) {
            return 'eliminated'
        }
        const where =
            destination === undefined
                ? 'no room: lost'
                : `to ${gameSession.gameState.map.label(destination)}`
        return loss > 0 ? `−${loss}, ${where}` : where
    }

    function separatelyLabel({ unit, fate }: RetreatingUnit): string {
        if (stage.alone === unit.id) {
            return 'Now tap its locale'
        }
        return fate === RetreatFate.NoRoom ? 'Save this unit' : 'Send separately'
    }
</script>

<div class="nt-battle-prompt">
    Every piece in the locale retreats and is shown. Artillery is lost.
    {#if plan.stranded > 0}
        There is not room for every unit: {plan.stranded} will be lost. Choose "Save this unit" to give
        another its place.
    {:else if stage.pickableIds.length > 0}
        Tap a locale on the map to send every unit there. To split them up, choose "Send separately"
        for a unit, then tap the locale that unit goes to.
    {:else if plan.room.size > 1}
        Tap a locale on the map to choose where they retreat.
    {/if}
    {#if plan.groups.length > 0}
        Tap a unit to change the steps it loses.
    {/if}
</div>
<div class="flex flex-wrap gap-x-4 gap-y-1">
    {#each plan.units as retreating (retreating.unit.id)}
        {@const unit = retreating.unit}
        <div class="flex flex-wrap items-center gap-2">
            <UnitTile
                playerId={unit.playerId}
                face={gameSession.visibleFace(unit)}
                label="Change this unit's loss"
                selected={stage.alone === unit.id}
                onclick={retreating.owesLoss
                    ? () => gameSession.cycleRetreatLoss(unit.id)
                    : undefined}
            />
            <span class="nt-battle-faint">{fateOf(retreating)}</span>
            {#if stage.pickableIds.includes(unit.id)}
                <button
                    type="button"
                    class="nt-plain-button nt-battle-small"
                    class:nt-chosen={stage.alone === unit.id}
                    aria-pressed={stage.alone === unit.id}
                    onclick={() => gameSession.pickBattleUnit(unit.id)}
                    >{separatelyLabel(retreating)}</button
                >
            {/if}
            {#if unit.commanderId && plan.kept[unit.commanderId] !== undefined}
                {@const commanderId = unit.commanderId}
                <button
                    type="button"
                    class="nt-plain-button nt-battle-small"
                    class:nt-chosen={plan.kept[commanderId] === unit.id}
                    aria-pressed={plan.kept[commanderId] === unit.id}
                    onclick={() => gameSession.keepInCorps(commanderId, unit.id)}
                    >Stays with {commanderDefinition(commanderId).name}</button
                >
            {/if}
        </div>
    {/each}
</div>
{#each plan.groups as group (group.unitIds.join())}
    {#if group.assigned !== group.steps}
        <div class="nt-battle-warning">
            A group of {group.unitIds.length} must lose {group.steps} step{group.steps === 1
                ? ''
                : 's'}; {group.assigned} assigned.
        </div>
    {/if}
{/each}
<div class="pt-1">
    <button
        type="button"
        class="nt-plain-button"
        disabled={!plan.lossesValid}
        onclick={() => gameSession.commitRetreat()}>Retreat</button
    >
</div>
