<script lang="ts">
    import {
        GoodsHolderKind,
        anomalyDefinition,
        rewardGoodsHolders,
        sameHolder,
        shipDefinition,
        type GoodsHolder
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { systemName } from '$lib/utils/presentation.js'
    import { goodName } from '$lib/utils/trade.js'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const reward = $derived(gameState.goodsRewards.at(0))
    const placed = $derived(gameSession.rewardGoodsDraft.holders)
    const holders = $derived(reward ? rewardGoodsHolders(gameState, reward) : [])

    function holderName(holder: GoodsHolder): string {
        switch (holder.kind) {
            case GoodsHolderKind.Ship:
                return shipDefinition(holder.shipId).name
            case GoodsHolderKind.Base:
                return `Your base at ${systemName(holder.systemId)}`
            case GoodsHolderKind.Earth:
                return 'Earth'
        }
    }

    function placedAt(holder: GoodsHolder): number {
        return placed.filter((candidate) => sameHolder(candidate, holder)).length
    }
</script>

{#if reward}
    {@const left = reward.count - placed.length}
    {@const name = goodName(reward.good)}
    <div class="sh-step">
        <p class="hint">
            {anomalyDefinition(reward.anomalyId).name} gives {reward.count}
            {name}. Put them in the holds of your ships at {systemName(reward.systemId)} or on your base
            there; any you do not place are destroyed for $1B each. Undo takes one back.
        </p>
        <div class="holders">
            {#each holders as holder (holder.kind === GoodsHolderKind.Ship ? holder.shipId : holder.kind)}
                <button
                    type="button"
                    disabled={left === 0}
                    onclick={() => gameSession.addRewardGood(holder)}
                    >{holderName(holder)}{placedAt(holder) > 0
                        ? ` +${placedAt(holder)}`
                        : ''}</button
                >
            {/each}
            <button type="button" class="primary" onclick={() => gameSession.commitRewardGoods()}>
                {left === 0
                    ? `Place ${name}`
                    : `Place ${placed.length}, destroy ${left} for $${left}B`}
            </button>
        </div>
    </div>
{/if}

<style>
    .holders {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
    }
</style>
