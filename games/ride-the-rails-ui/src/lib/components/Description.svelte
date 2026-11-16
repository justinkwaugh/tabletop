<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import type { Description } from '$lib/utils/describeAction.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import RailroadName from './RailroadName.svelte'
    import SeatDot from './panel/SeatDot.svelte'

    const gameSession = getGameSession()

    /** `plainNames`: seats as plain text, where a seat dot already marks whose line it is. */
    /** `nameDots`: each plain seat name with its dot, where no row dot says whose line it is. */
    let {
        description,
        plainNames = false,
        nameDots = false
    }: { description: Description; plainNames?: boolean; nameDots?: boolean } = $props()

    function plainName(playerId: string, first: boolean): string {
        if (playerId !== gameSession.myPlayerId) return gameSession.getPlayerName(playerId)
        return first ? 'You' : 'you'
    }
</script>

{#each description as segment, index (index)}
    {#if typeof segment === 'string'}
        <span>{segment}</span>
    {:else if 'playerId' in segment && plainNames}
        <span class="font-semibold"
            >{#if nameDots}<span class="mr-1 inline-block align-[-2px]"
                    ><SeatDot playerId={segment.playerId} /></span
                >{/if}{plainName(segment.playerId, index === 0)}</span
        >
    {:else if 'playerId' in segment}
        <PlayerName
            playerId={segment.playerId}
            capitalization={index > 0 && segment.playerId === gameSession.myPlayerId
                ? 'none'
                : 'capitalize'}
        />
    {:else}
        <RailroadName railroadId={segment.railroadId} />
    {/if}
{/each}
