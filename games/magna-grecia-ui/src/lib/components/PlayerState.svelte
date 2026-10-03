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
            <RoadIcon size={30} {color} />
            <strong>{playerState.supplyRoads}</strong>
            <span class="staged">({playerState.stagingRoads})</span>
        </div>
        <div class="stat" title="City tiles: supply (staging area)">
            <CityIcon size={30} {color} />
            <strong>{playerState.supplyCities}</strong>
            <span class="staged">({playerState.stagingCities})</span>
        </div>
        <div class="stat" title="Markets left to build">
            <MarketIcon size={30} {color} />
            <strong>{marketsLeft}</strong>
        </div>
    </div>
    <div class="score">
        <span class="score-label">Score</span>
        <span class="part" title="Points to spend">
            <PointsIcon size={14} />
            <strong>{score.points}</strong>
        </span>
        <span class="part" title="Points from markets">
            <MarketIcon size={14} />
            <strong>{score.markets}</strong>
        </span>
        <span
            class="part"
            title="Points from oracles ({score.oracles / ORACLE_POINTS} × {ORACLE_POINTS})"
        >
            <OracleIcon size={14} />
            <strong>{score.oracles}</strong>
        </span>
        <span class="total" title="Score if the game ended now"
            >Total <strong>{score.total}</strong></span
        >
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
        position: relative;
        /* Libre Baskerville's line box sits capitals high; centre them optically */
        top: 0.09em;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 18px;
        font-weight: 700;
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
        padding: 10px 10px 9px;
    }

    .stat {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        font-size: 22px;
        line-height: 1;
    }

    .stat strong {
        color: #3d2410;
    }

    .staged {
        font-size: 14px;
        color: #8c6a45;
    }

    .score {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        padding: 4px 12px 5px;
        border-top: 1px solid rgba(107, 63, 29, 0.14);
        background: rgba(107, 63, 29, 0.07);
        font-size: 12px;
        color: #8c6a45;
    }

    .score-label {
        font-size: 9px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #a68660;
    }

    .part {
        display: inline-flex;
        align-items: center;
        gap: 3px;
    }

    .part strong {
        font-weight: 600;
    }

    .total {
        cursor: help;
    }

    .total strong {
        font-size: 13px;
        color: #6b4520;
    }

    .debug {
        padding: 0 12px 6px;
        font-size: 10px;
        color: #9b8466;
    }
</style>
