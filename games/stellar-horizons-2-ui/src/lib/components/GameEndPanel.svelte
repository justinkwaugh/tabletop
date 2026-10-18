<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { GameResult } from '@tabletop/common'
    import { VictoryKind, campaignScore, galacticRank } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const anomalyRace = $derived(
        gameState.scenarioDefinition().victory.kind === VictoryKind.Anomalies
    )
    const scored = $derived(gameState.scenarioDefinition().victory.kind === VictoryKind.Score)
    const scores = $derived(
        scored
            ? gameState.players
                  .map((player) => ({
                      playerId: player.playerId,
                      total: campaignScore(gameState, player.playerId).total
                  }))
                  .toSorted((a, b) => b.total - a.total)
            : []
    )
</script>

<div class="end">
    {#if gameState.result === GameResult.Loss && anomalyRace}
        <p>
            No more anomalies can be found and nobody can reach four with those that remain, so the
            voyages end in {gameState.year} without a winner.
        </p>
    {:else if gameState.result === GameResult.Loss}
        <p>
            {gameState.numPlayers === 1 ? 'You did not' : 'Nobody managed to'} settle ten colonists on
            a world of population 25 by the end of {gameState.year}. Everyone loses.
        </p>
    {:else if scored}
        <p>The campaign ends in {gameState.year}.</p>
        <ol class="scores">
            {#each scores as entry (entry.playerId)}
                <li class:winner={gameState.winningPlayerIds.includes(entry.playerId)}>
                    <PlayerName playerId={entry.playerId} />
                    <span>{entry.total} VP · {galacticRank(entry.total)}</span>
                </li>
            {/each}
        </ol>
    {:else}
        <p class="inline-flex flex-wrap items-center justify-center gap-x-1">
            {#each gameState.winningPlayerIds as playerId, index (playerId)}
                <PlayerName {playerId} />{index < gameState.winningPlayerIds.length - 1
                    ? ' and'
                    : ''}
            {/each}
            {gameState.result === GameResult.Draw ? 'share the victory' : 'wins'}{anomalyRace
                ? `, having resolved four anomalies by ${gameState.year}.`
                : `, establishing humanity's first great colony among the stars in ${gameState.year}.`}
        </p>
    {/if}
</div>

<style>
    .end {
        text-align: center;
        padding: 8px;
        color: #f2c94c;
        font-size: 16px;
    }

    .scores {
        display: inline-flex;
        flex-direction: column;
        gap: 2px;
        margin-top: 4px;
        font-size: 14px;
        color: #dbe7f5;
    }

    .scores li {
        display: flex;
        justify-content: space-between;
        gap: 16px;
    }

    .scores li.winner {
        color: #f2c94c;
        font-weight: 700;
    }
</style>
