<script lang="ts">
    import type { FreshFishGameSession } from '$lib/stores/FreshFishGameSession.svelte'
    import { getContext } from 'svelte'
    import PlayerName from './PlayerName.svelte'
    import type { EndAuction } from '@tabletop/fresh-fish'
    let { action }: { action: EndAuction } = $props()
</script>

<div class="p-2 ms-4 text-sm">
    <div class="text-xs text-white flex flex-col justify-center items-left space-y-1">
        {#each (action as EndAuction).metadata?.participants ?? [] as participant}
            <div>
                <PlayerName playerId={participant.playerId} />
                bid ${participant.bid}
            </div>
        {/each}
    </div>
</div>
<p class="mt-1 text-left text-sm text-base font-normal text-gray-200">
    <PlayerName playerId={(action as EndAuction).winnerId} />
    won the auction with a bid of ${(action as EndAuction).highBid}
</p>
