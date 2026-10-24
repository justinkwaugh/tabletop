<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        BLOCKADE_INFLUENCE,
        BlockadeStep,
        blockadeDefence,
        blockadeSystems,
        blockadeableBases,
        canBlockade,
        combinedDefence,
        fleetCombatIn
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { plural, systemName } from '$lib/utils/presentation.js'
    import EscalationDiscardChoice from '../escalation/EscalationDiscardChoice.svelte'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const playerId = $derived(gameSession.myPlayerId ?? '')
    const pending = $derived(
        gameState.escalationDiscard?.playerId === playerId ? gameState.escalationDiscard : undefined
    )
    const growth = $derived(gameState.blockadeStep === BlockadeStep.Growth)
    const systems = $derived(blockadeSystems(gameState, playerId))
    const draft = $derived(gameSession.blockadeDraft)
    const bases = $derived(draft ? blockadeableBases(gameState, playerId, draft.systemId) : [])
    const force = $derived(draft ? fleetCombatIn(gameState, playerId, draft.systemId) : 0)
    const defence = $derived(
        draft ? combinedDefence(gameState, draft.targetIds, draft.systemId) : 0
    )
    const ready = $derived(
        draft !== undefined && canBlockade(gameState, playerId, draft.systemId, draft.targetIds)
    )
</script>

<div class="sh-step">
    {#if pending}
        <EscalationDiscardChoice drawn={pending.drawn} />
    {:else}
        <p class="hint">
            Before {growth ? 'growth and migration' : 'base production'}, you may blockade other
            factions' bases where your ships' combat value beats their ships and settlements there,
            all together. A blockaded base {growth
                ? 'neither grows nor migrates'
                : 'produces half, with no anomaly bonus'}. Each base you blockade draws you an
            escalation marker and gives its owner {BLOCKADE_INFLUENCE} IP.
        </p>
        <div class="row">
            {#each systems as systemId (systemId)}
                <button
                    type="button"
                    class:chosen={draft?.systemId === systemId}
                    aria-pressed={draft?.systemId === systemId}
                    onclick={() => gameSession.chooseBlockadeSystem(systemId)}
                    >{systemName(systemId)}</button
                >
            {/each}
        </div>
        {#if draft}
            <div class="row">
                {#each bases as base (base.playerId)}
                    {@const named = draft.targetIds.includes(base.playerId)}
                    <button
                        type="button"
                        class="target"
                        class:chosen={named}
                        aria-pressed={named}
                        onclick={() => gameSession.toggleBlockadeTarget(base.playerId)}
                    >
                        <PlayerName playerId={base.playerId} />
                        <span class="note"
                            >{plural(base.settlements, 'settlement')} · defends with {blockadeDefence(
                                gameState,
                                base.playerId,
                                draft.systemId
                            )}</span
                        >
                    </button>
                {/each}
            </div>
            <p class="balance">
                Your ships: <b>{force}</b> against <b>{defence}</b>
            </p>
            <div class="row">
                <button
                    type="button"
                    class="primary"
                    disabled={!ready}
                    onclick={() => gameSession.commitBlockade()}
                    >{draft.targetIds.length > 0
                        ? `Blockade ${plural(draft.targetIds.length, 'base')}`
                        : 'Name the bases to blockade'}</button
                >
            </div>
        {/if}
        <div class="row">
            <button type="button" onclick={() => gameSession.endBlockades()}
                >{gameState.blockades.some((blockade) => blockade.playerId === playerId)
                    ? 'No more blockades'
                    : 'No blockade'}</button
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

    .note {
        font-size: 12px;
        color: #9fb4d0;
    }

    .balance {
        margin: 0;
    }
</style>
