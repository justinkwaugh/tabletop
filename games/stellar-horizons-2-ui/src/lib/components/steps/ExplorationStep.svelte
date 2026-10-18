<script lang="ts">
    import {
        EXPLORATION_STEP,
        canExplore,
        explorationValue,
        isExplore,
        isStartTurn,
        malfunctionRate,
        ShipKind,
        shipDefinition
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { anomalyOpportunities } from '$lib/utils/anomalyAttempts.js'
    import { columnFill } from '$lib/utils/columnFill.js'
    import { plural, systemName } from '$lib/utils/presentation.js'
    import ShipTile from '../ShipTile.svelte'
    import AnomalyAttempt from './AnomalyAttempt.svelte'
    import ExplorationResult from './ExplorationResult.svelte'
    import EventAttempt from './EventAttempt.svelte'
    import OperationsPanel from './OperationsPanel.svelte'
    import PactList from './PactList.svelte'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const playerId = $derived(gameSession.myPlayerId ?? '')
    const explorers = $derived(
        gameState.shipsOf(playerId).filter((ship) => canExplore(gameState, ship))
    )
    const events = $derived(
        gameState.events.filter(
            (event) =>
                gameState.shipsOf(playerId).some((ship) => ship.systemId === event.systemId) ||
                gameState
                    .getPlayerState(playerId)
                    .eventAttempts.some((attempt) => attempt.eventId === event.eventId)
        )
    )
    const opportunities = $derived(
        anomalyOpportunities(gameState, playerId, gameSession.anomalyDraft)
    )
    // The malfunction rate is the same for every RE and for every CV, so it is shown once per
    // kind that can explore.
    const risks = $derived(
        [ShipKind.RE, ShipKind.CV].flatMap((kind) => {
            const ship = explorers.find(
                (candidate) => shipDefinition(candidate.shipId).kind === kind
            )
            return ship ? [{ kind, rate: malfunctionRate(gameState, ship) }] : []
        })
    )
    const results = $derived.by(() => {
        const actions = gameSession.actions
        const turnStart = actions.findLastIndex((action) => isStartTurn(action))
        return actions
            .slice(turnStart + 1)
            .filter((action) => isExplore(action) && action.playerId === playerId)
    })

    // Results fill columns two deep, left to right; when that many columns would not fit the
    // panel, the columns that do fit grow deeper.
    const RESULT_COLUMN_WIDTH = 300
    let resultsWidth = $state(0)
    const resultFill = $derived(columnFill(results.length, resultsWidth, RESULT_COLUMN_WIDTH, 2))

    function odds(value: number): string {
        const guaranteed = Math.floor(value / EXPLORATION_STEP)
        const chance = (value % EXPLORATION_STEP) * 10
        if (guaranteed === 0) {
            return `${chance}% chance of a tech marker`
        }
        const markers = plural(guaranteed, 'tech marker')
        return chance > 0 ? `${markers}, and a ${chance}% chance of another` : markers
    }

    // Guaranteed markers, when there are any, then the chance of one more: "1 + 30%" or "80%".
    function shortOdds(value: number): string {
        const guaranteed = Math.floor(value / EXPLORATION_STEP)
        const chance = (value % EXPLORATION_STEP) * 10
        return guaranteed > 0 ? `${guaranteed} + ${chance}%` : `${chance}%`
    }
</script>

<div class="sh-step">
    <PactList />
    {#if opportunities.length > 0}
        <div class="prompt">Send ships to resolve an anomaly</div>
        <div class="anomalies">
            {#each opportunities as opportunity (opportunity.systemId)}
                <AnomalyAttempt {opportunity} />
            {/each}
        </div>
    {/if}
    {#if events.length > 0}
        <div class="prompt">Meet an event's challenge</div>
        <div class="anomalies">
            {#each events as event (event.eventId)}
                <EventAttempt {event} />
            {/each}
        </div>
    {/if}
    <OperationsPanel />
    {#if explorers.length > 0}
        <div class="prompt">
            Choose a ship to explore with
            {#each risks as risk (risk.kind)}
                <span class="risk">{risk.kind} malfunction {risk.rate}%</span>
            {/each}
        </div>
    {/if}
    <div class="cards">
        {#each explorers as ship (ship.shipId)}
            {@const value = explorationValue(gameState, ship)}
            <ShipTile
                ship={shipDefinition(ship.shipId)}
                named={false}
                selected={gameSession.selectedShip?.shipId === ship.shipId}
                label="Show {shipDefinition(ship.shipId).name} at {systemName(ship.systemId)}"
                onclick={() => gameSession.locateShip(ship.shipId)}
            >
                <div class="odds" title="Exploration value {value}: {odds(value)}">
                    {shortOdds(value)}
                </div>
                <button
                    type="button"
                    class="primary explore"
                    aria-label="Explore with {shipDefinition(ship.shipId).name}"
                    title="Exploration value {value}: {odds(value)}"
                    onclick={() => gameSession.explore(ship.shipId)}>Explore</button
                >
            </ShipTile>
        {:else}
            <p class="empty">
                {opportunities.length > 0
                    ? 'No ships can explore a system this turn.'
                    : 'No ships can explore this turn.'}
            </p>
        {/each}
    </div>
    {#if results.length > 0}
        <div class="results-area" bind:clientWidth={resultsWidth}>
            <div
                class="results"
                class:columns={resultFill.columns > 1}
                style:--result-columns={resultFill.columns}
                style:--result-rows={resultFill.rows}
                role="table"
                aria-label="Exploration results"
            >
                {#each results as result, index (result.id)}
                    <ExplorationResult
                        action={result}
                        heads={index % resultFill.rows === 0}
                        follows={index >= resultFill.rows}
                    />
                {/each}
            </div>
        </div>
    {/if}
</div>

<style>
    .anomalies {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .risk {
        font-size: 13px;
        color: #8fa4c2;
    }

    .odds {
        margin-top: 2px;
        font-size: 15px;
        color: #e8f1ff;
    }

    .explore {
        margin-top: 2px;
    }

    /* The results sit in their own darker panel, like the cargo transfer. Each result is the
       ship's name and outcome labels above four shared columns: exploration die, what it
       found, malfunction dice, anything salvaged. With room, results fill several columns. */
    .results {
        display: grid;
        grid-template-columns: 40px max-content max-content 1fr;
        column-gap: 10px;
        width: fit-content;
        max-width: 100%;
        box-sizing: border-box;
        padding: 2px 14px;
        border: 1px solid #22314d;
        border-radius: 8px;
        background: #070a12;
        overflow-x: auto;
    }

    .results.columns {
        grid-auto-flow: column;
        grid-template-rows: repeat(var(--result-rows), auto);
        grid-template-columns: repeat(var(--result-columns), 40px max-content max-content 1fr);
        padding-right: 6px;
    }

    @media (max-width: 639px) {
        .results {
            width: auto;
            padding: 2px 10px;
        }
    }
</style>
