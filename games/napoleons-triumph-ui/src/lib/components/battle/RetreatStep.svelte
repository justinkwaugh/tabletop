<script lang="ts">
    import { UnitType, commanderDefinition, type ProjectedUnit, type Side } from '@tabletop/napoleons-triumph'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeLocale } from '$lib/model/battle.js'
    import UnitTile from '$lib/components/UnitTile.svelte'

    let { side, oncancel }: { side: Side; oncancel?: () => void } = $props()

    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)
    const plan = $derived(gameSession.retreatDraft)
    const alone = $derived(gameSession.battleDraft.retreatUnitId)

    function strengthOf(unit: ProjectedUnit): number {
        return unit.face?.strength ?? 0
    }

    function owesLoss(unit: ProjectedUnit): boolean {
        return plan?.groups.some((group) => group.unitIds.includes(unit.id)) === true
    }

    function cycleLoss(unit: ProjectedUnit) {
        if (!plan) {
            return
        }
        const next = ((plan.losses[unit.id] ?? 0) + 1) % (strengthOf(unit) + 1)
        const allocation = { ...plan.losses }
        if (next === 0) {
            delete allocation[unit.id]
        } else {
            allocation[unit.id] = next
        }
        gameSession.updateBattleDraft({ allocation })
    }

    function keep(commanderId: string, unitId: string) {
        gameSession.updateBattleDraft({ kept: { ...plan?.kept, [commanderId]: unitId } })
    }

    function marker(unit: ProjectedUnit): string {
        if (!plan) {
            return ''
        }
        if (unit.face?.type === UnitType.Artillery) {
            return 'lost'
        }
        const loss = plan.losses[unit.id] ?? 0
        if (loss >= strengthOf(unit)) {
            return 'eliminated'
        }
        const to = plan.destinations[unit.id]
        const where = to === undefined ? 'no room: lost' : `to ${describeLocale(game, to)}`
        return loss > 0 ? `−${loss}, ${where}` : where
    }
</script>

{#if plan}
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
                    {side}
                    face={gameSession.visibleFace(unit)}
                    label="Change this unit's loss"
                    selected={alone === unit.id}
                    onclick={owesLoss(unit) ? () => cycleLoss(unit) : undefined}
                />
                <span class="nt-battle-faint">{marker(unit)}</span>
                {#if plan.destinations[unit.id] !== undefined && plan.room.size > 1}
                    <button
                        type="button"
                        class="nt-plain-button nt-battle-small"
                        class:nt-chosen={alone === unit.id}
                        aria-pressed={alone === unit.id}
                        onclick={() =>
                            gameSession.updateBattleDraft({
                                retreatUnitId: alone === unit.id ? undefined : unit.id
                            })}>Send by itself</button
                    >
                {/if}
                {#if unit.commanderId && plan.kept[unit.commanderId] !== undefined}
                    <button
                        type="button"
                        class="nt-plain-button nt-battle-small"
                        class:nt-chosen={plan.kept[unit.commanderId] === unit.id}
                        aria-pressed={plan.kept[unit.commanderId] === unit.id}
                        onclick={() => unit.commanderId && keep(unit.commanderId, unit.id)}
                        >Stays with {commanderDefinition(unit.commanderId).name}</button
                    >
                {/if}
            </div>
        {/each}
    </div>
    {#each plan.groups as group (group.unitIds.join())}
        {@const taken = group.unitIds.reduce((sum, id) => sum + (plan.losses[id] ?? 0), 0)}
        {#if taken !== group.steps}
            <div class="nt-battle-warning">
                A group of {group.unitIds.length} must lose {group.steps} step{group.steps === 1 ? '' : 's'}; {taken} assigned.
            </div>
        {/if}
    {/each}
    <div class="flex flex-wrap gap-2 pt-1">
        <button
            type="button"
            class="nt-plain-button"
            disabled={!plan.lossesValid}
            onclick={() => gameSession.commitRetreat()}>Retreat</button
        >
        {#if oncancel}
            <button type="button" class="nt-plain-button" onclick={oncancel}>Stand and defend instead</button>
        {/if}
    </div>
{/if}
