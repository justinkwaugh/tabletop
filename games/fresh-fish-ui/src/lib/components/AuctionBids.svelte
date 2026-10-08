<script lang="ts">
    import type { EndAuction } from '@tabletop/fresh-fish'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import { losingBids } from '$lib/utils/auctionBids.js'
    import Disk from './Disk.svelte'

    let { action, discSize = 22 }: { action: EndAuction; discSize?: number } = $props()

    const gameSession = getGameSession()

    let bids = $derived(losingBids(action))
</script>

<span class="inline-flex flex-row flex-wrap items-center gap-x-3 gap-y-1">
    {#each bids as participant (participant.playerId)}
        <span
            class="inline-flex flex-row items-center tabular-nums"
            title="{gameSession.getPlayerName(participant.playerId)} bid ${participant.bid ?? 0}"
        >
            <!-- The disc art has a built-in margin; pull the amount in against the disc. -->
            <Disk
                color={gameSession.colors.getPlayerUiColor(participant.playerId)}
                size={discSize}
                class="-mr-[3px]"
            />
            ${participant.bid ?? 0}
        </span>
    {/each}
</span>
