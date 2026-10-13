<script lang="ts">
    import { commanderDefinition } from '@tabletop/napoleons-triumph'
    import UnitTile from '$lib/components/UnitTile.svelte'
    import type { RetreatStage } from '$lib/model/battleStage.js'
    import {
        RetreatFate,
        type AssignedLossGroup,
        type RetreatingUnit
    } from '$lib/model/retreatPlan.js'
    import { lossMark } from '$lib/model/roleMark.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import RetreatAccount from './RetreatAccount.svelte'

    let { stage }: { stage: RetreatStage } = $props()

    const gameSession = getGameSession()
    const plan = $derived(stage.plan)

    function fateOf({ fate, destination }: RetreatingUnit): string {
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
        return where
    }

    function steps(amount: number): string {
        return `${amount} step${amount === 1 ? '' : 's'}`
    }

    // Rule 12: why each group of a retreat owes its steps, for the sheet that accounts for them.
    function reasonFor(group: AssignedLossGroup): string {
        const { map } = gameSession.gameState
        const [first] = group.unitIds.map((id) => gameSession.gameState.unit(id))
        const blocked = first?.position?.approach
        const width = (approachId: number) => (map.approach(approachId).wide ? 'wide' : 'narrow')
        if (blocked !== undefined) {
            return `Blocking the ${width(blocked)} approach to ${map.label(map.approach(blocked).neighbour)}`
        }
        const defended = gameSession.attack?.defenseApproach
        return [
            `Infantry in reserve${fought ? ' that did not defend' : ''}`,
            ...(defended === undefined ? [] : [`the approach attacked being ${width(defended)}`])
        ].join(', ')
    }

    const fought = $derived((gameSession.attack?.defendingUnitIds.length ?? 0) > 0)
    const sections = $derived.by(() => {
        const owing = plan.groups.map((group) => ({
            key: group.unitIds.join(),
            owed: group.steps,
            shared: group.unitIds.length > 1,
            units: plan.units.filter(({ unit }) => group.unitIds.includes(unit.id))
        }))
        const rest = plan.units.filter((retreating) => !retreating.owesLoss)
        return [
            ...owing,
            ...(rest.length > 0
                ? [{ key: 'no step owed', owed: 0, shared: false, units: rest }]
                : [])
        ]
    })
    const account = $derived(
        plan.groups.map((group) => ({ text: reasonFor(group), steps: group.steps }))
    )
    const gunsLost = $derived(
        plan.units.filter((retreating) => retreating.fate === RetreatFate.GunsLost).length
    )

    let explaining = $state(false)

    function separatelyLabel({ unit, fate }: RetreatingUnit): string {
        if (stage.alone === unit.id) {
            return 'Now tap its locale'
        }
        return fate === RetreatFate.NoRoom ? 'Save this unit' : 'Send separately'
    }
</script>

{#snippet row(retreating: RetreatingUnit)}
    {@const unit = retreating.unit}
    <div class="flex flex-wrap items-center gap-2">
        <UnitTile
            playerId={unit.playerId}
            face={gameSession.visibleFace(unit)}
            label="Move a step of the loss onto this unit"
            roleMark={lossMark(retreating.loss)}
            selected={stage.alone === unit.id}
            onclick={retreating.sharesLoss
                ? () => gameSession.moveRetreatLossOnto(unit.id)
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
{/snippet}

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
</div>
{#each sections as section (section.key)}
    {#if plan.groups.length > 0}
        <div class="nt-battle-faint pt-1">
            {#if section.owed > 0}
                <button
                    type="button"
                    class="nt-retreat-owed"
                    aria-haspopup="dialog"
                    onclick={() => (explaining = true)}>Owes {steps(section.owed)}</button
                >{section.shared ? '. Tap one to move a step onto it.' : ''}
            {:else}
                Owes no steps
            {/if}
        </div>
    {/if}
    <div class="flex flex-wrap gap-x-4 gap-y-1">
        {#each section.units as retreating (retreating.unit.id)}
            {@render row(retreating)}
        {/each}
    </div>
{/each}
{#each plan.groups as group (group.unitIds.join())}
    {#if group.assigned !== group.steps}
        <div class="nt-battle-warning">
            A group of {group.unitIds.length} must lose {group.steps} step{group.steps === 1
                ? ''
                : 's'}; {group.assigned} assigned.
        </div>
    {/if}
{/each}
{#if explaining}
    <RetreatAccount lines={account} {gunsLost} onclose={() => (explaining = false)} />
{/if}
<div class="pt-1">
    <button
        type="button"
        class="nt-plain-button"
        disabled={!plan.lossesValid}
        onclick={() => gameSession.commitRetreat()}>Retreat</button
    >
</div>

<style>
    .nt-retreat-owed {
        cursor: pointer;
        text-decoration: underline dotted;
        text-decoration-thickness: 1px;
        text-underline-offset: 3px;
    }

    .nt-retreat-owed:hover {
        text-decoration-style: solid;
    }
</style>
