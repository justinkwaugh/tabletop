<script lang="ts">
    import ShownCards from '$lib/components/ShownCards.svelte'
    import { latestActorNotice } from '$lib/model/actionOutcomes.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let gameSession = getGameSession()
    let notice = $derived(latestActorNotice(gameSession.actions, gameSession.myPlayer?.id))
</script>

{#if notice}
    <div class="mb-2 rounded bg-oath-accent-soft px-2 py-1 text-xs">
        <p class="text-oath-heading">Only you see this.</p>
        <ShownCards cardIds={notice.cards} />
    </div>
{/if}
