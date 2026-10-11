<script lang="ts">
    import { PowerQuestionKind, SearchPlay, type PowerQuestion } from '@tabletop/oath'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import { cardChoices, toggleSingle } from '$lib/model/cardChoice.js'
    import { cardName } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let {
        question
    }: { question: Extract<PowerQuestion, { kind: PowerQuestionKind.PlayOrDiscardVision }> } =
        $props()

    let gameSession = getGameSession()
    let draft = $derived(gameSession.question)
    let busy = $derived(gameSession.busy)
    let reveal = $derived(draft.visionBlockedBecause(SearchPlay.RevealedVision))
    let adviser = $derived(draft.visionBlockedBecause(SearchPlay.Adviser))
    let discard = $derived(draft.visionBlockedBecause(SearchPlay.Discard))
</script>

<p class="text-sm mb-2">
    {cardName(question.visionCardId)} was discarded with your warband on it. Play it, or discard it.
</p>
{#if draft.visionDiscards.length > 0}
    <div class="mb-2 text-xs">
        <span class="text-oath-text-muted"
            >To keep it as an adviser, tap the adviser to discard:</span
        >
        <CardChoiceRow
            choices={cardChoices(draft.visionDiscards)}
            picked={draft.visionDiscard ? [draft.visionDiscard] : []}
            onpick={(cardId) =>
                draft.chooseVisionDiscard(toggleSingle(draft.visionDiscard, cardId))}
            {busy}
            height={80}
        />
    </div>
{/if}
<div class="flex flex-col gap-1">
    <button
        class="rounded border-[1.5px] border-oath-primary-border bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 px-2 py-1.5 text-sm font-semibold"
        disabled={busy || !!reveal}
        title={gameSession.humanizeReason(reveal)}
        onclick={() => draft.playVision(SearchPlay.RevealedVision)}
    >
        Reveal it as your Vision
    </button>
    <button
        class="rounded border-[1.5px] border-oath-primary-border bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 px-2 py-1.5 text-sm font-semibold"
        disabled={busy || !!adviser}
        title={gameSession.humanizeReason(adviser)}
        onclick={() => draft.playVision(SearchPlay.Adviser)}
    >
        Keep it as a facedown adviser
    </button>
    <button
        class="rounded bg-oath-control hover:bg-oath-control-hover disabled:opacity-40 px-2 py-1.5 text-sm font-semibold"
        disabled={busy || !!discard}
        title={gameSession.humanizeReason(discard)}
        onclick={() => draft.playVision(SearchPlay.Discard)}
    >
        Discard it
    </button>
</div>
