<script lang="ts">
    import PlaceText from '../PlaceText.svelte'
    import { commanderDefinition } from '@tabletop/napoleons-triumph'
    import UnitTile from '$lib/components/UnitTile.svelte'
    import type { RetreatStage } from '$lib/model/battleStage.js'
    import {
        RetreatFate,
        RetreatRowKind,
        retreatRows,
        type RetreatRow,
        type RetreatingUnit
    } from '$lib/model/retreatPlan.js'
    import { lossMark } from '$lib/model/roleMark.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import CommanderChip from './CommanderChip.svelte'
    import RetreatCostRule from './RetreatCostRule.svelte'

    let { stage }: { stage: RetreatStage } = $props()

    const gameSession = getGameSession()
    const plan = $derived(stage.plan)
    const rows = $derived(retreatRows(plan))
    const placesWithRoom = $derived([...plan.room.values()].filter((free) => free > 0).length)

    const FATES: Partial<Record<RetreatFate, string>> = {
        [RetreatFate.GunsLost]: 'cannot retreat',
        [RetreatFate.Eliminated]: 'destroyed'
    }

    function steps(amount: number): string {
        return `${amount} step${amount === 1 ? '' : 's'}`
    }

    function rowName(row: RetreatRow): string {
        if (row.kind === RetreatRowKind.Retreats) {
            return `To ${gameSession.gameState.map.label(row.locale)}`
        }
        return row.kind === RetreatRowKind.NoRoom ? 'No room: lost' : 'Lost'
    }

    function commanderOf(retreating: RetreatingUnit) {
        return plan.commanders.find((commander) => commander.unitId === retreating.unit.id)
    }

    const hint = $derived.by(() => {
        if (stage.movingCommander !== undefined) {
            return `Now tap the unit ${commanderDefinition(stage.movingCommander).name} stays with.`
        }
        if (stage.alone !== undefined) {
            return 'Now tap the locale this unit goes to.'
        }
        if (plan.stranded > 0) {
            const short = `There is not room for every unit: ${plan.stranded} will be lost.`
            if (placesWithRoom === 0) {
                return short
            }
            return placesWithRoom === 1
                ? `${short} Tap a unit to give it a place.`
                : `${short} Tap a unit, then a locale, to give it the place.`
        }
        if (stage.pickableIds.length > 0) {
            return 'Tap a locale to send them all there. Tap a unit, then a locale, to send it alone.'
        }
        return plan.room.size > 1 ? 'Tap a locale on the map to choose where they retreat.' : ''
    })
</script>

{#if plan.groups.length > 0}
    <RetreatCostRule {plan} />
{/if}
{#if stage.choosingLosses}
    {#each plan.groups as group (group.unitIds.join())}
        {#if plan.groups.length > 1}
            <div class="nt-battle-faint pt-1">Owes {steps(group.steps)}</div>
        {/if}
        <div class="flex flex-wrap gap-x-1 gap-y-0.5">
            {#each plan.units.filter( ({ unit }) => group.unitIds.includes(unit.id) ) as retreating (retreating.unit.id)}
                {@const unit = retreating.unit}
                <UnitTile
                    playerId={unit.playerId}
                    {...gameSession.lookOf(unit)}
                    label="Move a step of the loss onto this unit"
                    roleMark={lossMark(retreating.loss)}
                    onclick={group.open
                        ? () => gameSession.moveRetreatLossOnto(unit.id)
                        : undefined}
                />
            {/each}
        </div>
        {#if group.assigned !== group.steps}
            <div class="nt-battle-warning">
                A group of {group.unitIds.length} must lose {steps(group.steps)}; {group.assigned} assigned.
            </div>
        {/if}
    {/each}
    <div class="nt-battle-faint">Tap a unit to move a step onto it.</div>
    <div class="pt-1">
        <button
            type="button"
            class="nt-plain-button"
            disabled={!plan.lossesValid}
            onclick={() => gameSession.takeRetreatLosses()}>Take these losses</button
        >
    </div>
{:else}
    {#if hint}
        <div class="nt-battle-faint">{hint}</div>
    {/if}
    <div class="nt-retreat-rows">
        {#each rows as row (row.kind === RetreatRowKind.Retreats ? row.locale : row.kind)}
            <div class="nt-retreat-to">
                <PlaceText text={rowName(row)} />
                {#if row.kind === RetreatRowKind.Retreats && row.full && plan.stranded > 0}
                    <span class="nt-battle-faint">full</span>
                {/if}
            </div>
            <div class="nt-retreat-units">
                {#each row.units as retreating (retreating.unit.id)}
                    {@const unit = retreating.unit}
                    {@const commander = commanderOf(retreating)}
                    <span class="nt-retreat-unit">
                        <UnitTile
                            playerId={unit.playerId}
                            {...gameSession.lookOf(unit)}
                            label="Choose this unit"
                            roleMark={lossMark(retreating.loss)}
                            marker={FATES[retreating.fate]}
                            dimmed={row.kind !== RetreatRowKind.Retreats}
                            selected={stage.alone === unit.id}
                            onclick={stage.pickableIds.includes(unit.id)
                                ? () => gameSession.pickBattleUnit(unit.id)
                                : undefined}
                        />
                        {#if commander}
                            {@const name = commanderDefinition(commander.commanderId).name}
                            <CommanderChip
                                commanderId={commander.commanderId}
                                playerId={unit.playerId}
                                label={commander.movable
                                    ? `Choose the unit ${name} stays with`
                                    : `${name} stays with this unit`}
                                chosen={stage.movingCommander === commander.commanderId}
                                onclick={commander.movable
                                    ? () =>
                                          gameSession.liftRetreatingCommander(commander.commanderId)
                                    : undefined}
                            />
                        {/if}
                    </span>
                {/each}
            </div>
        {/each}
    </div>
    <div class="pt-1">
        <button
            type="button"
            class="nt-plain-button"
            disabled={!plan.lossesValid}
            onclick={() => gameSession.commitRetreat()}>Retreat</button
        >
    </div>
{/if}

<style>
    .nt-retreat-rows {
        display: grid;
        grid-template-columns: max-content 1fr;
        align-items: center;
        gap: 2px 14px;
    }

    .nt-retreat-to {
        font-size: 15px;
        font-style: italic;
        white-space: nowrap;
    }

    .nt-retreat-units {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 1px 4px;
    }

    .nt-retreat-unit {
        display: inline-flex;
        align-items: center;
    }

    @media (max-width: 639px) {
        .nt-retreat-rows {
            grid-template-columns: 1fr;
        }

        .nt-retreat-to {
            padding-top: 3px;
        }
    }
</style>
