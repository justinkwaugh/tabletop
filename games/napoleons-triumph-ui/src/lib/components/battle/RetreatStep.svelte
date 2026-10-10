<script lang="ts">
    import { UnitType, commanderDefinition, type ProjectedUnit } from '@tabletop/napoleons-triumph'
    import UnitTile from '$lib/components/UnitTile.svelte'
    import type { RetreatStage } from '$lib/model/battleStage.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { stage }: { stage: RetreatStage } = $props()

    const gameSession = getGameSession()
    const plan = $derived(stage.plan)

    function owesLoss(unit: ProjectedUnit): boolean {
        return plan.groups.some((group) => group.unitIds.includes(unit.id))
    }

    function fate(unit: ProjectedUnit): string {
        if (unit.face?.type === UnitType.Artillery) {
            return 'lost'
        }
        const loss = plan.losses[unit.id] ?? 0
        if (loss >= (unit.face?.strength ?? 0)) {
            return 'eliminated'
        }
        const to = plan.destinations[unit.id]
        const where =
            to === undefined ? 'no room: lost' : `to ${gameSession.gameState.map.label(to)}`
        return loss > 0 ? `−${loss}, ${where}` : where
    }
</script>

<div class="nt-battle-prompt">
    Every piece in the locale retreats and is shown. Artillery is lost.
    {#if plan.room.size > 1}
        Tap a locale on the map to send them all there, or pick one unit first to send it by itself.
    {/if}
    {#if plan.groups.length > 0}
        Tap a unit to change the steps it loses.
    {/if}
</div>
<div class="flex flex-wrap gap-x-4 gap-y-1">
    {#each plan.units as unit (unit.id)}
        <div class="flex flex-wrap items-center gap-2">
            <UnitTile
                playerId={unit.playerId}
                face={gameSession.visibleFace(unit)}
                label="Change this unit's loss"
                selected={stage.alone === unit.id}
                onclick={owesLoss(unit) ? () => gameSession.cycleRetreatLoss(unit.id) : undefined}
            />
            <span class="nt-battle-faint">{fate(unit)}</span>
            {#if stage.pickableIds.includes(unit.id)}
                <button
                    type="button"
                    class="nt-plain-button nt-battle-small"
                    class:nt-chosen={stage.alone === unit.id}
                    aria-pressed={stage.alone === unit.id}
                    onclick={() => gameSession.pickBattleUnit(unit.id)}>Send by itself</button
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
    {@const taken = group.unitIds.reduce((sum, id) => sum + (plan.losses[id] ?? 0), 0)}
    {#if taken !== group.steps}
        <div class="nt-battle-warning">
            A group of {group.unitIds.length} must lose {group.steps} step{group.steps === 1
                ? ''
                : 's'}; {taken} assigned.
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
