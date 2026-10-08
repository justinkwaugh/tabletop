<script lang="ts">
    import { isMarketTile, isStallTile, MachineState } from '@tabletop/fresh-fish'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGoodsName } from '$lib/utils/goodsNames.js'
    import { PLAIN_PLAYER_NAME } from '$lib/utils/playerNames.js'
    import { UNCLAIMED_STALL } from '$lib/utils/pieceColors.js'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import Disk from './Disk.svelte'
    import TiltedTile from './TiltedTile.svelte'
    import WoodMarket from './WoodMarket.svelte'
    import WoodStall from './WoodStall.svelte'

    let gameSession = getGameSession()

    let windowHeight: number | undefined = $state()
    let previewSize = $derived(windowHeight && windowHeight > 700 ? 84 : 56)

    let chosenTile = $derived(gameSession.gameState.chosenTile)
    let isAuctioning = $derived(gameSession.gameState.machineState === MachineState.AuctioningTile)
    let activePlayerIds = $derived(gameSession.gameState.activePlayerIds)
    let currentPlayerId = $derived(activePlayerIds.length === 1 ? activePlayerIds[0] : undefined)
</script>

<svelte:window bind:innerHeight={windowHeight} />

{#snippet player(playerId: string | undefined)}
    {#if playerId}
        <span class="player">
            <Disk color={gameSession.colors.getPlayerUiColor(playerId)} size={24} />
            <PlayerName {playerId} {...PLAIN_PLAYER_NAME} />
        </span>
    {/if}
{/snippet}

<div
    class="mb-2 flex flex-row justify-center items-center gap-6 rounded-md px-5 py-2.5 bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
>
    {#if isStallTile(chosenTile)}
        <TiltedTile>
            <WoodStall
                size={previewSize}
                color={isAuctioning
                    ? UNCLAIMED_STALL
                    : gameSession.colors.getPlayerUiColor(currentPlayerId)}
                goodsType={chosenTile.goodsType}
            />
        </TiltedTile>
    {:else if isMarketTile(chosenTile)}
        <TiltedTile>
            <WoodMarket size={previewSize} />
        </TiltedTile>
    {/if}

    <div class="flex flex-col justify-center items-center text-center">
        {#if isAuctioning}
            <h1 class="title">Waiting for bids</h1>
            <p class="line players">
                {#each activePlayerIds as playerId (playerId)}
                    {@render player(playerId)}
                {/each}
            </p>
        {:else if isStallTile(chosenTile)}
            <h1 class="title">Waiting for a stall</h1>
            <p class="line">
                {@render player(currentPlayerId)}
                is placing their {getGoodsName(chosenTile.goodsType)} stall
            </p>
        {:else if isMarketTile(chosenTile)}
            <h1 class="title">Waiting for a market</h1>
            <p class="line">{@render player(currentPlayerId)} is placing the market</p>
        {:else}
            <h1 class="title">Waiting</h1>
            <p class="line">{@render player(currentPlayerId)} is taking their turn</p>
        {/if}
    </div>
</div>

<style>
    .title {
        font-size: 1.125rem;
        font-weight: 600;
        line-height: 1.25;
    }
    .line {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 0 6px;
        font-size: 0.875rem;
        color: #9ca3af;
    }
    .players {
        gap: 0 14px;
    }
    .player {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        color: #e5e7eb;
    }
    @media (max-width: 640px) {
        .player > :global(svg) {
            width: 18px;
            height: 18px;
        }
    }
</style>
