<script lang="ts">
    import { type GameAction } from '@tabletop/common'
    import ShownCards from '$lib/components/ShownCards.svelte'
    import TokenText from '$lib/components/TokenText.svelte'
    import { describeAction } from '$lib/model/actionDescription.js'
    import { actorOnlyCards } from '$lib/model/actionOutcomes.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { action }: { action: GameAction } = $props()

    let gameSession = getGameSession()

    let text = $derived(describeAction(action, gameSession.historyNames, gameSession.myPlayer?.id))
    let seen = $derived(actorOnlyCards(action, gameSession.myPlayer?.id))
    let warbandColors = $derived(gameSession.historyWarbandColors(action))
</script>

<span><TokenText {text} {warbandColors} /></span>
{#if seen.length > 0}
    <span class="mt-1 block"><ShownCards cardIds={seen} height={48} /></span>
{/if}
