<script lang="ts">
    import { type GameAction } from '@tabletop/common'
    import ShownCards from '$lib/components/ShownCards.svelte'
    import TokenText from '$lib/components/TokenText.svelte'
    import { describeAction } from '$lib/model/actionDescription.js'
    import { actorOnlyCards } from '$lib/model/actionOutcomes.js'
    import { seatsById } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { action }: { action: GameAction } = $props()

    let gameSession = getGameSession()

    // Every seat the row names, the viewer's too, is its colour chip.
    let text = $derived(
        describeAction(action, seatsById(gameSession.historyNames), gameSession.myPlayer?.id)
    )
    let seats = $derived({ names: gameSession.historyNames, viewerId: gameSession.myPlayer?.id })
    let seen = $derived(actorOnlyCards(action, gameSession.myPlayer?.id))
    let warbandColor = $derived(gameSession.historyWarbandColor(action))
</script>

<span><TokenText {text} {warbandColor} {seats} /></span>
{#if seen.length > 0}
    <span class="mt-1 block"><ShownCards cardIds={seen} height={48} /></span>
{/if}
