<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        CombatKind,
        MachineState,
        combatValue,
        defendingShipOptions,
        owedEscalation,
        shipDefinition
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { COMBAT_KIND_LABELS, plural, systemName } from '$lib/utils/presentation.js'
    import EscalationDiscardChoice from '../escalation/EscalationDiscardChoice.svelte'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const machineState = $derived(gameState.machineState)
    const combat = $derived(gameState.combat)
    const discard = $derived(gameState.escalationDiscard)
    const pending = $derived(
        discard && discard.playerId === gameSession.myPlayerId ? discard : undefined
    )
    const systems = $derived([
        ...new Set(gameSession.attackChoices.map((option) => option.systemId))
    ])
    const draft = $derived(gameSession.attackDraft)
    const here = $derived(gameSession.attackSystemChoices)
    const option = $derived(gameSession.attackOption)

    const KIND_HINTS: Record<CombatKind, string> = {
        [CombatKind.Fleet]:
            'Choose your armed CVs to send. All their CVs here defend, and they may add their base.',
        [CombatKind.Assault]:
            'Choose your armed CVs to send against their base. They may add their CVs here.',
        [CombatKind.Ground]: 'Your base attacks theirs. They may add their CVs here.',
        [CombatKind.Raid]:
            'Choose one undamaged armed CV to raid their base. It may take damage doing so.',
        [CombatKind.Explorer]: 'Choose the RE to destroy and the CV to do it.'
    }

    function shipLabel(shipId: string): string {
        const ship = gameState.ship(shipId)
        const definition = shipDefinition(shipId)
        return `${definition.name} · combat ${combatValue(gameState, ship)} · CV-${definition.size}`
    }
</script>

<div class="sh-step">
    {#if machineState === MachineState.Attacking}
        {#if pending}
            <EscalationDiscardChoice drawn={pending.drawn} />
        {:else}
            <p class="hint">
                You may start one combat in each system where you have ships or a base. Choose a
                system on the map or here.
            </p>
            <div class="row">
                {#each systems as systemId (systemId)}
                    <button
                        type="button"
                        class:chosen={draft?.systemId === systemId}
                        aria-pressed={draft?.systemId === systemId}
                        onclick={() => gameSession.chooseAttackSystem(systemId)}
                        >{systemName(systemId)}</button
                    >
                {/each}
            </div>
            {#if draft}
                <div class="row">
                    {#each here as candidate (`${candidate.kind}:${candidate.defenderId}`)}
                        {@const chosen = candidate === option}
                        <button
                            type="button"
                            class="target"
                            class:chosen
                            aria-pressed={chosen}
                            onclick={() =>
                                gameSession.chooseAttack(candidate.kind, candidate.defenderId)}
                        >
                            <span>{COMBAT_KIND_LABELS[candidate.kind]}</span>
                            <PlayerName playerId={candidate.defenderId} />
                        </button>
                    {/each}
                </div>
            {/if}
            {#if draft && option}
                <p class="hint">{KIND_HINTS[option.kind]}</p>
                {#if option.kind === CombatKind.Explorer}
                    <div class="row">
                        {#each option.explorerIds as explorerId (explorerId)}
                            <button
                                type="button"
                                class:chosen={draft.explorerId === explorerId}
                                aria-pressed={draft.explorerId === explorerId}
                                onclick={() => gameSession.chooseExplorer(explorerId)}
                                >{shipDefinition(explorerId).name}</button
                            >
                        {/each}
                    </div>
                {/if}
                <div class="row">
                    {#each option.shipIds as shipId (shipId)}
                        <button
                            type="button"
                            class:chosen={draft.shipIds.includes(shipId)}
                            aria-pressed={draft.shipIds.includes(shipId)}
                            onclick={() => gameSession.toggleAttackShip(shipId)}
                            >{shipLabel(shipId)}</button
                        >
                    {/each}
                </div>
                <div class="row">
                    <button
                        type="button"
                        class="primary"
                        disabled={!gameSession.attackReady}
                        onclick={() => gameSession.commitAttack()}
                        >{COMBAT_KIND_LABELS[option.kind]}</button
                    >
                </div>
            {/if}
        {/if}
    {:else if machineState === MachineState.Defending && combat}
        <p class="hint">
            <PlayerName playerId={combat.attackerId} /> starts a {COMBAT_KIND_LABELS[
                combat.kind
            ].toLowerCase()} at {systemName(combat.systemId)}.
            {combat.kind === CombatKind.Fleet
                ? 'All your CVs there defend. Add your base to the defence?'
                : 'Your base defends. Choose which of your CVs there join it.'}
        </p>
        {#if combat.kind === CombatKind.Fleet}
            <div class="row">
                <button type="button" class="primary" onclick={() => gameSession.defend(true)}
                    >Defend with the base</button
                >
                <button type="button" onclick={() => gameSession.defend(false)}>Ships only</button>
            </div>
        {:else}
            <div class="row">
                {#each defendingShipOptions(gameState, combat) as shipId (shipId)}
                    <button
                        type="button"
                        class:chosen={gameSession.defenceDraft.shipIds.includes(shipId)}
                        aria-pressed={gameSession.defenceDraft.shipIds.includes(shipId)}
                        onclick={() => gameSession.toggleDefenceShip(shipId)}
                        >{shipLabel(shipId)}</button
                    >
                {/each}
            </div>
            <div class="row">
                <button type="button" class="primary" onclick={() => gameSession.defend(false)}
                    >{gameSession.defenceDraft.shipIds.length > 0
                        ? `Defend with ${plural(gameSession.defenceDraft.shipIds.length, 'ship')}`
                        : 'Defend with the base alone'}</button
                >
            </div>
        {/if}
    {:else if (machineState === MachineState.AssigningHits || machineState === MachineState.ResolvingRaid) && combat}
        <p class="hint">
            {machineState === MachineState.AssigningHits
                ? 'Choose the unit to take the next hit in the combat panel.'
                : "Choose the raid's result in the combat panel."}
        </p>
        {#if !gameSession.combatInFocus}
            <div class="row">
                <button type="button" onclick={() => gameSession.focusSystem(combat.systemId)}
                    >Show the combat</button
                >
            </div>
        {/if}
    {:else if machineState === MachineState.EndingCombat && combat}
        {@const owed = owedEscalation(combat)}
        <p class="hint">
            The defence included a ship that attacked you this turn or last, so you may decline the
            escalation markers; <PlayerName playerId={combat.defenderId} /> then gains no IP.
        </p>
        <div class="row">
            <button type="button" onclick={() => gameSession.endCombat(false)}
                >Draw {plural(owed, 'marker')}</button
            >
            <button type="button" class="primary" onclick={() => gameSession.endCombat(true)}
                >Decline</button
            >
        </div>
    {/if}
</div>

<style>
    .row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
    }

    .target {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
    }

    .chosen {
        outline: 2px solid #f2d27a;
        outline-offset: 1px;
    }
</style>
