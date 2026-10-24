<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { Description } from '$lib/utils/describe.js'

    let { description }: { description: Description } = $props()

    const gameSession = getGameSession()

    // A name pill is set off from the words after it, unless punctuation follows.
    function spaced(index: number, text: string): string {
        return index > 0 && typeof description[index - 1] !== 'string' && /^\w/.test(text)
            ? ` ${text}`
            : text
    }
</script>

{#each description as segment, index (index)}
    {#if typeof segment === 'string'}
        <span>{spaced(index, segment)}</span>
    {:else}
        <PlayerName
            playerId={segment.playerId}
            capitalization={index > 0 && segment.playerId === gameSession.myPlayerId
                ? 'none'
                : 'capitalize'}
        />
    {/if}
{/each}
