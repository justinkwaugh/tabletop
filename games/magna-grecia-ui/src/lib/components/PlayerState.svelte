<script lang="ts">
    import type { HydratedMagnaGreciaPlayerState, ScoreBreakdown } from '@tabletop/magna-grecia'
    import { ORACLE_POINTS } from '@tabletop/magna-grecia'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import CityIcon from './icons/CityIcon.svelte'
    import MarketIcon from './icons/MarketIcon.svelte'
    import OracleIcon from './icons/OracleIcon.svelte'
    import PointsIcon from './icons/PointsIcon.svelte'
    import RoadIcon from './icons/RoadIcon.svelte'

    let {
        playerState,
        score
    }: { playerState: HydratedMagnaGreciaPlayerState; score: ScoreBreakdown } = $props()

    const gameSession = getGameSession()

    const playerId = $derived(playerState.playerId)
    const color = $derived(gameSession.colors.getPlayerUiColor(playerId))
    const textColor = $derived(gameSession.colors.getPlayerTextColorValue(playerId))
    const isTurn = $derived(gameSession.gameState.activePlayerIds.includes(playerId))
    const marketsLeft = $derived(gameSession.gameState.board.marketsRemaining(playerId))
</script>

<div class="player" class:turn={isTurn} style:--player={color} style:--player-text={textColor}>
    <div class="banner">
        <span class="name">{gameSession.getPlayerName(playerId)}</span>
        <span class="points" title="Points to spend">
            <PointsIcon size={22} />
            {playerState.points}
        </span>
    </div>
    <div class="stats">
        <div class="stat" title="Road tiles: supply (staging area)">
            <RoadIcon size={22} {color} />
            <strong>{playerState.supplyRoads}</strong>
            <span class="staged">({playerState.stagingRoads})</span>
        </div>
        <div class="stat" title="City tiles: supply (staging area)">
            <CityIcon size={22} {color} />
            <strong>{playerState.supplyCities}</strong>
            <span class="staged">({playerState.stagingCities})</span>
        </div>
        <div class="stat" title="Markets left to build">
            <MarketIcon size={22} {color} />
            <strong>{marketsLeft}</strong>
        </div>
    </div>
    <div class="projection" title="Score if the game ended now">
        <span>Markets <strong>{score.markets}</strong></span>
        <span class="oracles">
            <OracleIcon size={18} />
            <strong>{score.oracles / ORACLE_POINTS}</strong>
        </span>
        <span class="total">Total <strong>{score.total}</strong></span>
    </div>
    {#if gameSession.showDebug}
        <div class="debug">id: {playerId}</div>
    {/if}
</div>

<style>
    .player {
        overflow: hidden;
        border-radius: 14px;
        background: #fbf5e6;
        box-shadow:
            inset 0 0 0 1.5px rgba(107, 63, 29, 0.35),
            0 2px 6px rgba(40, 24, 8, 0.15);
        color: #4a2c12;
    }

    .player.turn {
        box-shadow:
            inset 0 0 0 3px var(--player),
            0 0 0 2px #fff7df,
            0 3px 10px rgba(40, 24, 8, 0.3);
    }

    .banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 12px;
        background: var(--player);
        color: var(--player-text);
    }

    .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 18px;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
    }

    .points {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border-radius: 999px;
        padding: 1px 8px 1px 3px;
        background: rgba(255, 248, 225, 0.92);
        color: #4a2c12;
        font-size: 18px;
        font-weight: 700;
    }

    .stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 4px;
        padding: 8px 10px 4px;
    }

    .stat {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        font-size: 16px;
    }

    .staged {
        font-size: 13px;
        color: #8c6a45;
    }

    .projection {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        padding: 3px 12px 8px;
        font-size: 13px;
        color: #7a5732;
    }

    .oracles {
        display: inline-flex;
        align-items: center;
        gap: 2px;
    }

    .total strong {
        font-size: 15px;
        color: #4a2c12;
    }

    .debug {
        padding: 0 12px 6px;
        font-size: 10px;
        color: #9b8466;
    }
</style>
