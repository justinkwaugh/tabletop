<script lang="ts">
    import { isCallGameAction, type GameAction } from '@tabletop/common'
    import { CalledGameDescription } from '@tabletop/frontend-components'
    import type { Campaign } from '@tabletop/oath'
    import ShownCards from '$lib/components/ShownCards.svelte'
    import TokenText from '$lib/components/TokenText.svelte'
    import { describeAction, drawsSkulls } from '$lib/model/actionDescription.js'
    import { actorOnlyCards } from '$lib/model/actionOutcomes.js'
    import { seatsById } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // A Campaign's step row names its attacker from the Campaign it belongs to.
    let { action, campaign }: { action: GameAction; campaign?: Campaign } = $props()

    let gameSession = getGameSession()

    // Every seat the row names, the viewer's too, is its colour chip.
    let text = $derived(
        describeAction(
            action,
            seatsById(gameSession.historyNames),
            gameSession.myPlayer?.id,
            campaign
        )
    )
    let seats = $derived({ names: gameSession.historyNames, viewerId: gameSession.myPlayer?.id })
    let seen = $derived(actorOnlyCards(action, gameSession.myPlayer?.id))
    let warbandColor = $derived(gameSession.historyWarbandColor(action))
    let skulls = $derived(drawsSkulls(action))
</script>

{#if isCallGameAction(action)}
    <span><CalledGameDescription {action} /></span>
{:else}
    <span><TokenText {text} {warbandColor} {seats} {skulls} /></span>
    {#if seen.length > 0}
        <span class="mt-1 block"><ShownCards cardIds={seen} height={48} /></span>
    {/if}
{/if}
