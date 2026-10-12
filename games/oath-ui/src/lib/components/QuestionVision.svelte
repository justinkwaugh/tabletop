<script lang="ts">
    import { PowerQuestionKind, SearchPlay, type PowerQuestion } from '@tabletop/oath'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import MenuChoice from '$lib/components/MenuChoice.svelte'
    import QuestionForm from '$lib/components/QuestionForm.svelte'
    import { FACEDOWN_ADVISER_LABEL, PLAY_LABELS } from '$lib/model/adviserPlacements.js'
    import { cardChoices, toggleSingle } from '$lib/model/cardChoice.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { cardName } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let {
        question
    }: { question: Extract<PowerQuestion, { kind: PowerQuestionKind.PlayOrDiscardVision }> } =
        $props()

    const LABELS: Record<SearchPlay, string> = {
        ...PLAY_LABELS,
        [SearchPlay.Adviser]: FACEDOWN_ADVISER_LABEL
    }

    let gameSession = getGameSession()
    let draft = $derived(gameSession.question)
    let busy = $derived(gameSession.busy)
    // The plays are equal choices, one width; a play the engine refuses is not offered.
    const width = new ChoiceWidth()
</script>

<QuestionForm cardId={question.visionCardId}>
    {#snippet line()}Play {cardName(question.visionCardId)}, or discard it?{/snippet}
    {#if draft.visionDiscards.length > 0}
        <!-- R-5.1.4.II — at the adviser limit it goes facedown only over a discarded adviser. -->
        <div class="mb-2 text-sm">
            <span class="text-oath-text-muted">{FACEDOWN_ADVISER_LABEL}: discard 1 first.</span>
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
    <div class="flex flex-wrap gap-1.5">
        {#each draft.visionPlays as play (play)}
            <MenuChoice
                label={LABELS[play]}
                disabled={busy}
                {width}
                onclick={() => draft.playVision(play)}
            >
                {LABELS[play]}
            </MenuChoice>
        {/each}
    </div>
</QuestionForm>
