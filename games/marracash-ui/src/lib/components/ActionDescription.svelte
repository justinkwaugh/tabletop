<script lang="ts">
    import type { GameAction } from '@tabletop/common'
    import DirhamAmount from '$lib/components/DirhamAmount.svelte'
    import PlayerTag from '$lib/components/PlayerTag.svelte'
    import {
        getShop,
        isBringVisitors,
        isCompleteAntiqueSet,
        isMoveVisitors,
        isPlaceBid,
        isResolveAuction,
        isStartAuction,
        QueueEnd,
        type MarketColor,
        type ShopId
    } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PawnGroup from '$lib/components/PawnGroup.svelte'
    import { entranceGate } from '$lib/utils/historyTurns.js'
    import { shortOrdinal } from '$lib/utils/ordinal.js'
    import { movedVisitorColors, movedVisitors } from '$lib/utils/moneyReport.js'

    const MaxPawnsInSentence = 8
    const PawnHeight = 18

    // One sentence for a player's action, in the History tab's words, led by who took it.
    let { action }: { action: GameAction } = $props()
    const gameSession = getGameSession()

    function possessive(playerId: string, actorId: string): string {
        if (playerId === actorId)
            return playerId === gameSession.myPlayer?.id ? 'your own' : 'their own'
        return playerId === gameSession.myPlayer?.id
            ? 'your'
            : `${gameSession.getPlayerName(playerId)}’s`
    }
</script>

{#snippet swatch(color: MarketColor)}
    <span
        class="swatch"
        style:background={gameSession.marketPalettes[color].fill}
        style:border-color={gameSession.marketPalettes[color].stroke}
    ></span>
{/snippet}

{#snippet shop(shopId: ShopId)}
    {@const color = getShop(shopId).color}
    the {@render swatch(color)}
    {color} shop
{/snippet}

{#snippet actor(playerId: string)}<PlayerTag {playerId} />{' '}{/snippet}

{#if isStartAuction(action)}
    {@render actor(action.playerId)}put {@render shop(action.shopId)} up for auction.
{:else if isPlaceBid(action)}
    {@const seen = action.playerId === gameSession.myPlayer?.id ? action.amount : undefined}
    {@render actor(action.playerId)}
    {#if seen === undefined}
        placed a sealed bid.
    {:else if seen === 0}
        passed.
    {:else}
        bid <DirhamAmount amount={seen} />.
    {/if}
{:else if isResolveAuction(action) && action.metadata}
    {@const result = action.metadata}
    {@render actor(result.winnerId)}won {@render shop(result.shopId)} for {result.price}.
{:else if isMoveVisitors(action)}
    {@const result = action.metadata}
    {@const colors = result ? movedVisitorColors(result) : []}
    {@render actor(action.playerId)}moved
    {#if result && colors.length <= MaxPawnsInSentence}
        <PawnGroup {colors} height={PawnHeight} />{#if result.entries.length === 0}.{:else}:{/if}
    {:else}
        {result
            ? movedVisitors(result)
            : 'visitors'}{#if !result || result.entries.length === 0}.{:else}:{/if}
    {/if}
    {#each result?.entries ?? [] as entry, index (entry.shopId)}
        {entry.customers} into <b>{possessive(entry.ownerId, action.playerId)}</b>
        {@render swatch(getShop(entry.shopId).color)} shop{index < (result?.entries.length ?? 0) - 1
            ? ','
            : '.'}
    {/each}
{:else if isCompleteAntiqueSet(action) && action.metadata}
    {@render actor(action.collectorId)}completed {action.collectorId === gameSession.myPlayer?.id
        ? 'your'
        : 'their'}
    {shortOrdinal(action.metadata.rank)} antique set.
{:else if isBringVisitors(action)}
    {@render actor(action.playerId)}brought
    {#if action.metadata}
        <PawnGroup colors={action.metadata.visitors} height={PawnHeight} />
    {:else}
        {action.count} visitor{action.count === 1 ? '' : 's'}
    {/if}
    from the <b>{action.end === QueueEnd.Front ? 'front' : 'back'}</b> to the
    <b>{entranceGate(action.entranceId)}</b> gate.
{/if}

<style>
    .swatch {
        display: inline-block;
        width: 0.8em;
        height: 0.8em;
        border: 1.5px solid;
        border-radius: 3px;
        vertical-align: -0.08em;
    }
</style>
