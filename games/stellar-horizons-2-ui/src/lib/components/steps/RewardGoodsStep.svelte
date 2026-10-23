<script lang="ts">
    import { anomalyDefinition } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { systemName } from '$lib/utils/presentation.js'
    import { goodName } from '$lib/utils/trade.js'

    const gameSession = getGameSession()
    const reward = $derived(gameSession.myGoodsReward)
    const placed = $derived(gameSession.rewardGoodsDraft.holders.length)
</script>

{#if reward}
    {@const left = reward.count - placed}
    {@const name = goodName(reward.good)}
    <div class="sh-step">
        <p class="hint">
            {anomalyDefinition(reward.anomalyId).name} gives {reward.count}
            {name}. Choose your ships or your base at {systemName(reward.systemId)} to put them there;
            any you do not place are destroyed for $1B each. Undo takes one back.
        </p>
        <div class="buttons">
            <button type="button" class="primary" onclick={() => gameSession.commitRewardGoods()}>
                {left === 0 ? `Place ${name}` : `Place ${placed}, destroy ${left} for $${left}B`}
            </button>
        </div>
    </div>
{/if}
