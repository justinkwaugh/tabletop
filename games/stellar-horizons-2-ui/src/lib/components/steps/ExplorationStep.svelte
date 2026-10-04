<script lang="ts">
    import {
        EXPLORATION_STEP,
        canExplore,
        explorationValue,
        isExplore,
        isStartTurn,
        malfunctionRate,
        shipDefinition,
        surveyThreshold
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { systemName } from '$lib/utils/presentation.js'
    import ShipTile from '../ShipTile.svelte'
    import ExplorationResult from './ExplorationResult.svelte'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const playerId = $derived(gameSession.myPlayerId ?? '')
    const explorers = $derived(
        gameState.shipsOf(playerId).filter((ship) => canExplore(gameState, ship))
    )
    const threshold = $derived(surveyThreshold(gameState.numPlayers))
    const results = $derived.by(() => {
        const actions = gameSession.actions
        const turnStart = actions.findLastIndex((action) => isStartTurn(action))
        return actions
            .slice(turnStart + 1)
            .filter((action) => isExplore(action) && action.playerId === playerId)
    })

    function odds(value: number): string {
        const guaranteed = Math.floor(value / EXPLORATION_STEP)
        const chance = (value % EXPLORATION_STEP) * 10
        return chance > 0
            ? `${guaranteed} marker${guaranteed === 1 ? '' : 's'} + ${chance}% for one more`
            : `${guaranteed} marker${guaranteed === 1 ? '' : 's'}`
    }
</script>

<div class="sh-step">
    <p class="hint">
        Every full 10 of exploration value earns a tech marker; the rest is the chance of one more.
        Markers totalling {threshold}+ from one exploration complete a survey.
    </p>
    <div class="cards">
        {#each explorers as ship (ship.shipId)}
            {@const value = explorationValue(gameState, ship)}
            <ShipTile ship={shipDefinition(ship.shipId)}>
                <div class="stats" title={odds(value)}>
                    {systemName(ship.systemId)} · {value}
                </div>
                <div class="stats">{malfunctionRate(gameState, ship)}% malfunction</div>
                <button
                    type="button"
                    class="primary"
                    onclick={() => gameSession.explore(ship.shipId)}>Explore</button
                >
            </ShipTile>
        {:else}
            <p class="empty">No ships can explore this turn.</p>
        {/each}
    </div>
    {#each results as result (result.id)}
        <ExplorationResult action={result} />
    {/each}
</div>
