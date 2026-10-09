<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { PowerQuestionKind, discardRegionFor, type PowerQuestion } from '@tabletop/oath'
    import DiscardOrderCards from '$lib/components/DiscardOrderCards.svelte'
    import { cardName, regionName } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let {
        question
    }: {
        question: Extract<
            PowerQuestion,
            { kind: PowerQuestionKind.OrderDrawnCards | PowerQuestionKind.OrderDiscards }
        >
    } = $props()
    let pileRegion = $derived(
        question.kind === PowerQuestionKind.OrderDiscards
            ? discardRegionFor(question.fromRegion)
            : question.region
    )

    let gameSession = getGameSession()
    let draft = $derived(gameSession.question)
    let busy = $derived(gameSession.busy)
    let refused = $derived(draft.stackBlockedBecause)
</script>

<p class="text-sm mb-2">
    {cardName(question.cardId)}: tap the cards in the order they go onto the {regionName(
        pileRegion
    )} discard pile. The last goes on top.
</p>
<div class="flex flex-wrap gap-2 mb-2">
    <DiscardOrderCards
        cards={draft.stackCards}
        tapped={draft.stackTapped}
        {busy}
        ontap={(cardId) => draft.tapStack(cardId)}
    />
</div>
{#if refused}<p class="mb-2 text-[11px] text-oath-danger">
        <TokenText text={gameSession.humanizeReason(refused) ?? ''} />
    </p>{/if}
<div class="flex gap-2">
    <button
        class="grow rounded border-[1.5px] border-oath-primary-border bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 px-2 py-1.5 text-sm font-semibold"
        disabled={busy || !draft.stackComplete || !!refused}
        onclick={() => draft.stack()}
    >
        Stack them
    </button>
</div>
