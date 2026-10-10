<script lang="ts">
    import {
        DecisionKind,
        commanderDefinition,
        isInDefenseReserve,
        nextDecision,
        type Side
    } from '@tabletop/napoleons-triumph'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { toggled } from '$lib/model/battle.js'
    import Force from './Force.svelte'

    let { side }: { side: Side } = $props()

    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)
    const decision = $derived(nextDecision(game))
    const draft = $derived(gameSession.battleDraft)

    const allocated = $derived(Object.values(draft.allocation).reduce((sum, steps) => sum + steps, 0))

    function addLoss(unitId: string, limit: number) {
        const strength = game.unit(unitId).face?.strength ?? 1
        const current = draft.allocation[unitId] ?? 0
        const next = current >= strength || allocated >= limit ? 0 : current + 1
        const allocation = { ...draft.allocation }
        if (next === 0) {
            delete allocation[unitId]
        } else {
            allocation[unitId] = next
        }
        gameSession.updateBattleDraft({ allocation })
    }

    const lossMarkers = $derived(
        Object.fromEntries(Object.entries(draft.allocation).map(([id, steps]) => [id, `−${steps}`]))
    )

    function corpsUnits(commanderId: string) {
        const attack = gameSession.attack
        return (attack?.attackingUnitIds ?? [])
            .flatMap((id) => game.findUnit(id) ?? [])
            .filter((unit) => unit.commanderId === commanderId)
    }

    const advancing = $derived(gameSession.battleStage?.picked ?? [])
    const advancingCommanders = $derived(
        [...new Set(advancing.flatMap((id) => game.unit(id).commanderId ?? []))].filter((commanderId) => {
            const commander = game.commander(commanderId)
            return (
                commander.position !== undefined &&
                game.corpsUnits(commanderId).some((unit) => isInDefenseReserve(game, unit)) &&
                !draft.commanderIds.includes(`stay:${commanderId}`)
            )
        })
    )
</script>

{#if decision?.kind === DecisionKind.OddLoss}
    <div class="nt-battle-prompt">The loss is odd. Choose which enemy leading unit takes the extra step.</div>
    <Force
        side={game.sideOf(game.unit(decision.unitIds[0]).playerId)}
        units={decision.unitIds.map((id) => game.unit(id))}
        onpick={(id) => gameSession.pickBattleUnit(id)}
    />
{:else if decision?.kind === DecisionKind.ExcessLosses}
    <div class="nt-battle-prompt">
        Your other units in the fight must lose {decision.amount} step{decision.amount === 1 ? '' : 's'}.
        Tap a unit to add a step.
    </div>
    <Force
        {side}
        units={decision.unitIds.map((id) => game.unit(id))}
        selected={Object.keys(draft.allocation)}
        markers={lossMarkers}
        onpick={(id) => addLoss(id, decision.amount)}
    />
    <div class="pt-1">
        <button
            type="button"
            class="nt-plain-button"
            disabled={allocated !== decision.amount}
            onclick={() => gameSession.assignLosses(draft.allocation)}
            >Take the losses ({allocated} of {decision.amount})</button
        >
    </div>
{:else if decision?.kind === DecisionKind.Regroup}
    <div class="nt-battle-prompt">
        The attack is thrown back. One unit stays with each commander; the rest are detached.
    </div>
    {#each decision.commanderIds as commanderId (commanderId)}
        {@const units = corpsUnits(commanderId)}
        {@const kept = draft.kept[commanderId] ?? units[0]?.id}
        <div class="nt-battle-faint">{commanderDefinition(commanderId).name}</div>
        <Force
            {side}
            {units}
            selected={kept ? [kept] : []}
            markers={kept ? { [kept]: 'stays' } : {}}
            onpick={(id) => gameSession.updateBattleDraft({ kept: { ...draft.kept, [commanderId]: id } })}
        />
    {/each}
    <div class="pt-1">
        <button
            type="button"
            class="nt-plain-button"
            onclick={() =>
                gameSession.regroup(
                    Object.fromEntries(
                        decision.commanderIds.map((commanderId) => [
                            commanderId,
                            draft.kept[commanderId] ?? corpsUnits(commanderId)[0]?.id ?? ''
                        ])
                    )
                )}>Regroup</button
        >
    </div>
{:else if decision?.kind === DecisionKind.Advance}
    <div class="nt-battle-prompt">
        At least one defending unit steps up to block the approach. Units leaving their commander
        behind are detached.
    </div>
    <Force
        {side}
        units={decision.unitIds.map((id) => game.unit(id))}
        selected={advancing}
        markers={Object.fromEntries(advancing.map((id) => [id, 'advances']))}
        onpick={(id) => gameSession.pickBattleUnit(id)}
    />
    <div class="flex flex-wrap items-center gap-2 pt-1">
        {#each [...new Set(advancing.flatMap((id) => game.unit(id).commanderId ?? []))] as commanderId (commanderId)}
            {@const goes = advancingCommanders.includes(commanderId)}
            <button
                type="button"
                class="nt-plain-button nt-battle-small"
                class:nt-chosen={goes}
                aria-pressed={goes}
                onclick={() =>
                    gameSession.updateBattleDraft({
                        commanderIds: toggled(draft.commanderIds, `stay:${commanderId}`)
                    })}>{commanderDefinition(commanderId).name} goes with them</button
            >
        {/each}
        <button
            type="button"
            class="nt-plain-button"
            disabled={advancing.length === 0}
            onclick={() => gameSession.advance(advancing, advancingCommanders)}>Advance to the approach</button
        >
    </div>
{/if}
