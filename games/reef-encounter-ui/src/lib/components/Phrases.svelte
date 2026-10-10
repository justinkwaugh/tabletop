<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { capitalised, type Phrase } from '$lib/utils/actionDescription.js'

    let { phrases }: { phrases: readonly Phrase[] } = $props()
</script>

{#each phrases as phrase, index (index)}
    <p class="detail">
        {#if phrase.playerId}
            <PlayerName playerId={phrase.playerId} />
            {phrase.text}
        {:else}
            {capitalised(phrase.text)}
        {/if}
    </p>
{/each}
