<script lang="ts">
    import type { Snippet } from 'svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { lead }: { lead?: Snippet } = $props()
    const gameSession = getGameSession()

    let options = $derived(
        [
            gameSession.canMove ? "move a fountain's visitors" : undefined,
            gameSession.canAuction ? 'auction an unowned shop' : undefined
        ].filter((option) => option !== undefined)
    )
    let prompt = $derived(options.join(', or '))
</script>

{#if gameSession.selectedFountainId === undefined}
    <p class="marracash-prompt">
        {@render lead?.()}{prompt.charAt(0).toUpperCase()}{prompt.slice(1)}.
    </p>
{:else}
    <p class="marracash-prompt">{@render lead?.()}Choose the destination for these visitors.</p>
{/if}
