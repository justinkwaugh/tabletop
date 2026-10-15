<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import PhraseLine from './PhraseLine.svelte'
    import type { Phrase } from '$lib/utils/actionDescription.js'

    let { phrases }: { phrases: readonly Phrase[] } = $props()
</script>

{#each phrases as phrase, index (index)}
    <p class="detail">
        {#if phrase.playerId}
            <PlayerName playerId={phrase.playerId} />
            <PhraseLine {phrase} />
        {:else}
            <PhraseLine {phrase} capitalise />
        {/if}
    </p>
{/each}
