<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { AnomalyChallenge, shipDefinition } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { AnomalyOpportunity } from '$lib/utils/anomalyAttempts.js'
    import { systemName } from '$lib/utils/presentation.js'
    import AnomalyTile from '../AnomalyTile.svelte'
    import ShipTile from '../ShipTile.svelte'
    import PactEditor from './PactEditor.svelte'
    import { PactTargetKind } from '@tabletop/stellar-horizons-2'
    import { candidatePartners, type PactSubject } from '$lib/utils/pacts.js'

    const TILE_WIDTH = 92

    let { opportunity }: { opportunity: AnomalyOpportunity } = $props()

    const gameSession = getGameSession()
    const anomaly = $derived(opportunity.summary.anomaly)
    const difficulty = $derived(opportunity.summary.difficulty)
    const science = $derived(anomaly.challenge === AnomalyChallenge.Science)
    const value = $derived(science ? 'exploration' : 'combat')
    let proposing = $state(false)
    const subject: PactSubject = $derived({
        targetKind: PactTargetKind.Anomaly,
        targetId: opportunity.summary.anomaly.id,
        challenge: opportunity.summary.anomaly.challenge,
        systemId: opportunity.systemId
    })
    const partners = $derived(
        candidatePartners(gameSession.gameState, gameSession.myPlayerId ?? '', subject)
    )
    const committed = $derived(
        opportunity.committedShipIds?.map((shipId) => shipDefinition(shipId).name).join(', ')
    )
</script>

<section
    class="attempt"
    class:science
    aria-label="{anomaly.name} at {systemName(opportunity.systemId)}"
>
    <AnomalyTile anomalyId={anomaly.id} {difficulty} width={TILE_WIDTH} />
    <div class="body">
        <div class="title">
            {anomaly.name}
            <span class="where">at {systemName(opportunity.systemId)}</span>
            <span class="need">needs {difficulty} {value}</span>
        </div>
        {#if committed}
            <p class="committed">
                Committed: {committed}. It resolves at the end of the decade, in initiative order.
            </p>
        {:else}
            <div class="ships">
                {#each opportunity.ships as entry (entry.ship.shipId)}
                    {@const definition = shipDefinition(entry.ship.shipId)}
                    <ShipTile
                        ship={definition}
                        named={false}
                        selected={entry.chosen}
                        label="{entry.chosen ? 'Take' : 'Send'} {definition.name} {entry.chosen
                            ? 'off'
                            : 'against'} {anomaly.name}"
                        onclick={() =>
                            gameSession.toggleAnomalyShip(opportunity.systemId, entry.ship.shipId)}
                    >
                        <div class="strength" class:chosen={entry.chosen}>+{entry.strength}</div>
                    </ShipTile>
                {/each}
                <div class="commit">
                    <span
                        class="total"
                        class:enough={opportunity.chosenStrength >= difficulty}
                        title="{value} value of the chosen ships against the {difficulty} needed"
                        >{opportunity.chosenStrength} / {difficulty}</span
                    >
                    <button
                        type="button"
                        class="primary"
                        disabled={opportunity.chosenStrength < difficulty}
                        onclick={() => gameSession.commitAnomalyDraft()}>Commit ships</button
                    >
                </div>
            </div>
            {#if opportunity.availableStrength < difficulty}
                <p class="hint">
                    Your ships here total {opportunity.availableStrength}; bring {difficulty -
                        opportunity.availableStrength} more to resolve it.
                </p>
            {/if}
        {/if}
        {#if anomaly.noExploration}
            <p class="hint">
                Ships cannot explore {systemName(opportunity.systemId)} until this is resolved.
            </p>
        {/if}
        {#if !opportunity.committedShipIds && partners.length > 0 && !proposing}
            <div class="pact-offer">
                <button type="button" onclick={() => (proposing = true)}>Propose a pact</button>
                <span class="hint"
                    >Resolve it together with another faction, splitting the reward.</span
                >
            </div>
        {/if}
        {#if proposing}
            <PactEditor {subject} onclose={() => (proposing = false)} />
        {/if}
        {#each opportunity.rivals as rival (rival.playerId)}
            <p class="rival inline-flex flex-wrap items-center gap-x-1">
                <PlayerName playerId={rival.playerId} />
                has committed ships here and resolves {rival.resolvesFirst ? 'before' : 'after'} you.
            </p>
        {/each}
    </div>
</section>

<style>
    .attempt {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        padding: 10px;
        border: 1px solid #22314d;
        border-left: 4px solid #e2552b;
        border-radius: 8px;
        background: #0d1322;
    }

    .attempt.science {
        border-left-color: #2f9fd8;
    }

    .pact-offer {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
    }

    .body {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
    }

    .title {
        font-size: 16px;
        font-weight: 700;
        color: #e8f1ff;
    }

    .where,
    .need {
        margin-left: 6px;
        font-size: 13px;
        font-weight: 400;
        color: #8fa4c2;
    }

    .need {
        color: #f2c94c;
    }

    .ships {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
    }

    .strength {
        margin-top: 2px;
        font-size: 15px;
        color: #8fa4c2;
    }

    .strength.chosen {
        color: #e8f1ff;
        font-weight: 700;
    }

    .commit {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-left: 6px;
    }

    .total {
        font-size: 20px;
        font-weight: 700;
        color: #f0a37c;
    }

    .total.enough {
        color: #7fd88a;
    }

    .committed,
    .rival {
        font-size: 13px;
        color: #c5d3e6;
    }
</style>
