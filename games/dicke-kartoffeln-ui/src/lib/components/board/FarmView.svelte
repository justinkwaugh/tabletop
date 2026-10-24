<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Farm from './Farm.svelte'
    import MarketBoard from './MarketBoard.svelte'
    import MessageArea from './MessageArea.svelte'
    import { compactTable } from '$lib/utils/tableLayout.svelte.js'
    import { FARM_ART_HEIGHT, FARM_ART_WIDTH } from '$lib/utils/farmLayouts.js'

    const gameSession = getGameSession()

    // The main farm is turned a quarter clockwise, so it lies FARM_HEIGHT wide.
    const FARM_WIDTH = 620
    const FARM_HEIGHT = Math.round((FARM_WIDTH * FARM_ART_HEIGHT) / FARM_ART_WIDTH)
    const MARKET_WIDTH = 600
    const MINI_GAP = 10
    const compact = $derived(compactTable.current)
    const width = $derived(compact ? FARM_HEIGHT + 20 : FARM_HEIGHT + MARKET_WIDTH + 18)

    const shownId = $derived(gameSession.farmPlayerId ?? gameSession.gameState.players[0].playerId)
    const others = $derived(
        gameSession.gameState.players.filter((player) => player.playerId !== shownId)
    )
    // Mini farms are turned too; each lies miniLength wide.
    const miniLength = $derived(
        Math.min(
            Math.round((205 * FARM_ART_HEIGHT) / FARM_ART_WIDTH),
            Math.floor((FARM_HEIGHT - MINI_GAP * (others.length - 1)) / others.length)
        )
    )
    const miniWidth = $derived(Math.floor((miniLength * FARM_ART_WIDTH) / FARM_ART_HEIGHT))
    const hasMessages = $derived(gameSession.gameState.messages !== undefined)
</script>

<div class="table" class:compact style:width="{width}px">
    <div class="left" style:width="{FARM_HEIGHT}px">
        <div class="main" style:width="{FARM_HEIGHT}px" style:height="{FARM_WIDTH}px">
            <div class="captions">
                <div
                    class="caption"
                    style:background={gameSession.colors.getPlayerBgColorValue(shownId)}
                    style:color={gameSession.colors.getPlayerTextColorValue(shownId)}
                >
                    <PlayerName playerId={shownId} possessive={true} capitalization="uppercase" />
                    <span>farm</span>
                </div>
                {#if gameSession.myPlayerId && shownId !== gameSession.myPlayerId}
                    <button type="button" class="mine" onclick={() => gameSession.showMyFarm()}
                        >show my farm</button
                    >
                {/if}
            </div>
            <div
                class="turned"
                style:--turn-x="{FARM_HEIGHT}px"
                style:width="{FARM_WIDTH}px"
                style:height="{FARM_HEIGHT}px"
            >
                <Farm playerId={shownId} width={FARM_WIDTH} />
            </div>
        </div>
        <div class="others" style:gap="{MINI_GAP}px">
            {#each others as player (player.playerId)}
                <button
                    type="button"
                    class="mini"
                    style:width="{miniLength}px"
                    style:height="{miniWidth}px"
                    title="Show this farm"
                    onclick={() => gameSession.showFarm(player.playerId)}
                >
                    <div
                        class="label"
                        style:background={gameSession.colors.getPlayerBgColorValue(player.playerId)}
                    >
                        <PlayerName playerId={player.playerId} capitalization="uppercase" />
                    </div>
                    <div
                        class="turned"
                        style:--turn-x="{miniLength}px"
                        style:width="{miniWidth}px"
                        style:height="{miniLength}px"
                    >
                        <Farm playerId={player.playerId} width={miniWidth} interactive={false} />
                    </div>
                </button>
            {/each}
        </div>
    </div>
    <div
        class="middle"
        style:width="{MARKET_WIDTH}px"
        style:zoom={compact ? FARM_HEIGHT / MARKET_WIDTH : undefined}
    >
        <MarketBoard width={MARKET_WIDTH} height={hasMessages ? 590 : 880} />
        <MessageArea cardWidth={136} onRead={(messageId) => gameSession.readMessage(messageId)} />
    </div>
</div>

<style>
    .table {
        display: flex;
        gap: 18px;
    }

    .table.compact {
        flex-direction: column;
        align-items: center;
        padding: 0 10px;
    }

    .left {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .main {
        position: relative;
    }

    .turned {
        position: absolute;
        top: 0;
        left: 0;
        transform: translateX(var(--turn-x)) rotate(90deg);
        transform-origin: top left;
    }

    .captions {
        position: absolute;
        z-index: 2;
        top: 8px;
        left: 50%;
        display: flex;
        align-items: center;
        gap: 8px;
        transform: translateX(-50%);
    }

    .caption {
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
        border-radius: 999px;
        padding: 2px 12px;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        text-transform: uppercase;
        font-size: 20px;
        color: #4a2c16;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    .mine {
        border: 2px solid #fff6dc;
        border-radius: 999px;
        background: #6e3b1c;
        padding: 2px 12px;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        text-transform: uppercase;
        color: #fff6dc;
        font-size: 18px;
        white-space: nowrap;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    .mine:hover {
        background: #8a4b25;
    }

    .middle {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .others {
        display: flex;
        justify-content: center;
    }

    .mini {
        position: relative;
        border-radius: 8px;
        transition: transform 120ms ease-out;
    }

    .mini:hover {
        transform: translateY(-3px);
    }

    .label {
        position: absolute;
        z-index: 2;
        top: 4px;
        left: 50%;
        transform: translateX(-50%);
        border-radius: 999px;
        padding: 0 4px;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        text-transform: uppercase;
        font-size: 15px;
        white-space: nowrap;
    }
</style>
