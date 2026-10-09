<script lang="ts">
    import { PLAIN_PLAYER_NAME } from '$lib/utils/playerNames.js'
    import { GameResult } from '@tabletop/common'
    import GoodsIcon from '$lib/components/GoodsIcon.svelte'
    import Disk from '$lib/components/Disk.svelte'
    import { Scorer } from '@tabletop/fresh-fish'
    import { getGoodsName } from '$lib/utils/goodsNames.js'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let gameSession = getGameSession()

    const maxDistance = $derived(
        Scorer.MAXIMUM_DISTANCE_BY_PLAYER_COUNT[gameSession.game.players.length]
    )

    let isWin = $derived(gameSession.gameState.result === GameResult.Win)
    let winners = $derived(new Set(gameSession.gameState.winningPlayerIds))
    let myPlayerId = $derived(gameSession.myPlayer?.id)
    // PlayerName renders the viewer as "you", which takes the plural verb.
    let verb = $derived(isWin ? (winners.has(myPlayerId ?? '') ? 'win' : 'wins') : 'tie')
    let winningScore = $derived(
        gameSession.gameState.getPlayerState(gameSession.gameState.winningPlayerIds[0] ?? '')?.score
    )
    let goodsTypes = $derived(
        gameSession.gameState.players[0]?.stalls.map((stall) => stall.goodsType) ?? []
    )

    let ranked = $derived(gameSession.gameState.players.toSorted((a, b) => b.score - a.score))

    function penalty(distance: number | undefined) {
        return distance ? Math.min(maxDistance, distance) : maxDistance
    }
</script>

<div
    class="mb-2 flex flex-col items-center gap-3 rounded-md px-2 sm:px-4 pt-3 pb-4 bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
>
    <div class="flex flex-col items-center gap-0.5">
        <h1 class="title">Game over</h1>
        <p class="result">
            {#each gameSession.gameState.winningPlayerIds as winner, i (winner)}
                {#if i > 0}<span>and</span>{/if}
                <Disk color={gameSession.colors.getPlayerUiColor(winner)} size={22} />
                <PlayerName
                    playerId={winner}
                    capitalization={i > 0 && winner === myPlayerId ? 'none' : 'capitalize'}
                    {...PLAIN_PLAYER_NAME}
                />
            {/each}
            <span>{verb} with {winningScore}</span>
        </p>
    </div>

    <div class="w-full overflow-x-auto">
        <table class="sheet m-auto">
            <thead>
                <tr>
                    <th></th>
                    {#each goodsTypes as goodsType (goodsType)}
                        <th title={getGoodsName(goodsType)}>
                            <svg viewBox="0 0 20 20" width="26" height="26" class="inline-block">
                                <GoodsIcon {goodsType} color="#d1d5db" />
                            </svg>
                        </th>
                    {/each}
                    <th class="head">Money</th>
                    <th class="head">Total</th>
                </tr>
            </thead>
            <tbody>
                {#each ranked as player (player.playerId)}
                    <tr class={winners.has(player.playerId) ? 'winner' : ''}>
                        <td class="who"
                            ><span class="who-inner">
                                <Disk
                                    color={gameSession.colors.getPlayerUiColor(player.playerId)}
                                    size={22}
                                />
                                <span>{gameSession.getPlayerName(player.playerId)}</span>
                                {#if winners.has(player.playerId)}<span class="star">&#x2605;</span
                                    >{/if}
                            </span></td
                        >
                        {#each goodsTypes as goodsType (goodsType)}
                            {@const stall = player.stalls.find((s) => s.goodsType === goodsType)}
                            <td
                                class="num"
                                title={stall?.distance
                                    ? `${stall.distance} steps from its truck`
                                    : 'Never placed'}
                            >
                                &minus;{penalty(stall?.distance)}
                            </td>
                        {/each}
                        <td class="num">+{player.money}</td>
                        <td class="num total">{player.score}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
</div>

<style>
    .title {
        font-family: var(--ff-label-font, inherit);
        font-size: 1.6rem;
        line-height: 1.1;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }
    .result {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 0 6px;
        font-size: 1.05rem;
        color: #e5e7eb;
    }
    .result > :global(svg) {
        margin-right: -4px;
    }
    .sheet {
        border-collapse: collapse;
    }
    th {
        padding: 0 10px 4px;
        font-weight: normal;
    }
    .head {
        font-family: var(--ff-label-font, inherit);
        font-size: 0.8rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #9ca3af;
        vertical-align: bottom;
    }
    td {
        padding: 3px 10px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
    }
    .who {
        padding-left: 8px;
        font-weight: 600;
        white-space: nowrap;
    }
    /* Flex lives inside the cell, so the row's background stays one even band. */
    .who-inner {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .who-inner > :global(svg) {
        margin-right: -2px;
    }
    .star {
        color: #ffd36b;
    }
    .num {
        font-family: var(--ff-label-font, inherit);
        font-size: 1.05rem;
        text-align: center;
        font-variant-numeric: tabular-nums;
        color: #d1d5db;
    }
    .total {
        font-size: 1.3rem;
        color: #ffffff;
    }
    .winner td {
        background: rgba(255, 255, 255, 0.06);
    }
    @media (max-width: 640px) {
        .title {
            font-size: 1.3rem;
        }
        .result {
            font-size: 0.9rem;
        }
        th,
        td {
            padding-left: 4px;
            padding-right: 4px;
        }
        th svg {
            width: 20px;
            height: 20px;
        }
        .head {
            font-size: 0.65rem;
        }
        .who {
            padding-left: 4px;
            font-size: 0.85rem;
        }
        .who-inner {
            gap: 4px;
        }
        .num {
            font-size: 0.9rem;
        }
        .total {
            font-size: 1.05rem;
        }
    }
</style>
