<script lang="ts">
    import {
        ActionType,
        isDrawTile,
        isEndAuction,
        isMarketTile,
        isPlaceDisk,
        isPlaceMarket,
        isPlaceStall,
        isStallTile,
        type GoodsType
    } from '@tabletop/fresh-fish'
    import type { GameAction } from '@tabletop/common'
    import { fade } from 'svelte/transition'
    import { flip } from 'svelte/animate'
    import { quartIn } from 'svelte/easing'
    import { createTimeAgo, GameSessionMode, PlayerName } from '@tabletop/frontend-components'
    import { getDescriptionForAction } from '$lib/utils/actionDescriptions.js'
    import { getGoodsName } from '$lib/utils/goodsNames.js'
    import Disk from './Disk.svelte'
    import AuctionBids from './AuctionBids.svelte'
    import { losingBids } from '$lib/utils/auctionBids.js'
    import { auctionedGoodsById, groupByTimeLabel } from '$lib/utils/historyEntries.js'
    import { PLAIN_PLAYER_NAME } from '$lib/utils/playerNames.js'
    import WoodStall from './WoodStall.svelte'
    import WoodMarket from './WoodMarket.svelte'
    import { UNCLAIMED_STALL } from '$lib/utils/pieceColors.js'
    import BagIcon from './BagIcon.svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    const timeAgo = createTimeAgo()

    let gameSession = getGameSession()
    let unhighlightTimeout: ReturnType<typeof setTimeout>

    let reversedActions = $derived.by(() => {
        const reversed = gameSession.actions
            .filter(
                (action) =>
                    ![ActionType.PlaceBid as string, ActionType.StartAuction as string].includes(
                        action.type
                    ) && !(isDrawTile(action) && isMarketTile(action.metadata?.chosenTile))
            )
            .toReversed()
            .toSorted(
                (a, b) =>
                    (b.createdAt?.getTime() ?? Date.now()) - (a.createdAt?.getTime() ?? Date.now())
            )
        return reversed
    })

    let auctionedGoods = $derived(auctionedGoodsById(gameSession.actions))
    let groups = $derived(
        groupByTimeLabel(reversedActions, (action) =>
            action.createdAt ? timeAgo.format(action.createdAt) : 'Earlier'
        )
    )

    function highlight(action: GameAction) {
        if (gameSession.isViewingHistory) {
            return
        }
        if (unhighlightTimeout) {
            clearTimeout(unhighlightTimeout)
        }
        gameSession.setHighlightedCoordsForAction(action)
    }

    function unhighlight() {
        if (gameSession.isViewingHistory) {
            return
        }
        if (unhighlightTimeout) {
            clearTimeout(unhighlightTimeout)
        }
        unhighlightTimeout = setTimeout(() => {
            gameSession.clearHighlightedCoords()
        }, 250)
    }
</script>

<div
    class="h-full min-h-[300px] overflow-hidden rounded-md bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
>
    <div class="h-full overflow-auto px-1.5 pb-2">
        {#if gameSession.game.finishedAt && !gameSession.isViewingHistory}
            {@render marker('Game over', timeAgo.format(gameSession.game.finishedAt))}
        {/if}
        {#each groups as group (group.actions[0].id)}
            <div class="when bg-gray-200 dark:bg-gray-800">{group.label}</div>
            {#each group.actions as action (action.id)}
                <div
                    class="entry bg-white/70 dark:bg-gray-700/45"
                    role="button"
                    tabindex={-1}
                    onfocus={() => {}}
                    onkeypress={() => {}}
                    in:fade={{ duration: 200, easing: quartIn }}
                    out:fade={{ duration: 50 }}
                    animate:flip={{ duration: 100 }}
                    onmouseover={() => highlight(action)}
                    onmouseleave={() => unhighlight()}
                >
                    <div class="piece">
                        {@render piece(action)}
                    </div>
                    <div class="min-w-0 text-sm leading-snug">
                        {#if isEndAuction(action)}
                            <PlayerName playerId={action.winnerId} {...PLAIN_PLAYER_NAME} /> won the
                            {#if auctionedGoods.get(action.id)}
                                {getGoodsName(auctionedGoods.get(action.id)!)} stall
                            {:else}
                                auction
                            {/if}
                            for ${action.highBid}
                            {#if losingBids(action).length > 0}
                                <div class="bids">
                                    <AuctionBids {action} discSize={18} showNames />
                                </div>
                            {/if}
                        {:else}
                            {#if action.playerId}
                                <PlayerName playerId={action.playerId} {...PLAIN_PLAYER_NAME} />
                            {/if}
                            {getDescriptionForAction(action)}
                        {/if}
                    </div>
                </div>
            {/each}
        {/each}
        {@render marker('Game started', timeAgo.format(gameSession.game.createdAt))}
    </div>
</div>

{#snippet marker(text: string, when: string)}
    <div class="marker">
        <span>{text}</span>
        <span class="opacity-60">· {when}</span>
    </div>
{/snippet}

{#snippet stallPiece(color: string, goodsType: GoodsType | undefined)}
    <div class="tile">
        <WoodStall size={28} showName={false} {color} {goodsType} />
    </div>
{/snippet}

{#snippet piece(action: GameAction)}
    {#if isPlaceDisk(action)}
        <Disk color={gameSession.colors.getPlayerUiColor(action.playerId)} size={30} />
    {:else if isPlaceStall(action)}
        {@render stallPiece(gameSession.colors.getPlayerUiColor(action.playerId), action.goodsType)}
    {:else if isPlaceMarket(action)}
        <div class="tile">
            <WoodMarket size={28} />
        </div>
    {:else if isDrawTile(action) && isStallTile(action.metadata?.chosenTile)}
        {@render stallPiece(UNCLAIMED_STALL, action.metadata.chosenTile.goodsType)}
    {:else if isDrawTile(action)}
        <BagIcon size={28} />
    {:else if isEndAuction(action)}
        {@render stallPiece(
            gameSession.colors.getPlayerUiColor(action.winnerId),
            auctionedGoods.get(action.id)
        )}
    {/if}
{/snippet}

<style>
    .when {
        position: sticky;
        top: 0;
        z-index: 1;
        padding: 8px 8px 4px;
        font-size: 0.75rem;
        color: rgb(107 114 128);
    }
    :global(.dark) .when {
        color: rgb(156 163 175);
    }
    .entry {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 4px;
        padding: 6px 8px;
        border-radius: 6px;
    }
    .entry:hover {
        filter: brightness(1.08);
    }
    .piece {
        display: flex;
        flex-shrink: 0;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
    }
    .tile {
        border-radius: 5px;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    }
    .bids {
        margin-top: 3px;
        font-size: 0.8rem;
    }
    .marker {
        padding: 10px 8px 4px;
        font-size: 0.75rem;
        text-align: center;
        color: rgb(107 114 128);
    }
    :global(.dark) .marker {
        color: rgb(156 163 175);
    }
</style>
