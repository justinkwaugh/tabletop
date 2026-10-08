<script lang="ts">
    import type { EndAuction, GoodsType } from '@tabletop/fresh-fish'
    import { getGoodsName } from '$lib/utils/goodsNames.js'
    import { losingBids } from '$lib/utils/auctionBids.js'
    import ActorLine from './ActorLine.svelte'
    import AuctionBids from './AuctionBids.svelte'

    let { action, goodsType }: { action: EndAuction; goodsType?: GoodsType } = $props()
</script>

<div class="flex flex-col items-center gap-0.5">
    <ActorLine playerId={action.winnerId}>
        won the {goodsType ? `${getGoodsName(goodsType)} stall` : 'auction'} for ${action.highBid}
    </ActorLine>
    {#if losingBids(action).length > 0}
        <span class="text-xs sm:text-sm text-gray-400"><AuctionBids {action} discSize={20} /></span>
    {/if}
</div>
