<script lang="ts">
    import ShownCards from '$lib/components/ShownCards.svelte'
    import { latestActorNotice } from '$lib/model/actionOutcomes.js'
    import { cardName } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let gameSession = getGameSession()
    let notice = $derived(latestActorNotice(gameSession.actions, gameSession.myPlayer?.id))
</script>

{#if notice}
    <div class="mb-2 rounded bg-oath-accent-soft px-2 py-1 text-xs">
        <p class="text-oath-heading">
            {notice.shownBy ? `${cardName(notice.shownBy)} showed you` : 'You were shown'}
            {#if notice.relicToDeckBottom !== undefined}
                , and {cardName(notice.relicToDeckBottom)} went to the bottom of the relic deck
            {/if}
        </p>
        <ShownCards cardIds={notice.cards} />
        <p class="text-oath-text-muted">Only you see this.</p>
    </div>
{/if}
