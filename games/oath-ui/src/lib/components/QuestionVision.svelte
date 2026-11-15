<script lang="ts">
    import { PowerQuestionKind, SearchPlay, type PowerQuestion } from '@tabletop/oath'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import FavorCost from '$lib/components/FavorCost.svelte'
    import FavorTo from '$lib/components/FavorTo.svelte'
    import MenuChoice from '$lib/components/MenuChoice.svelte'
    import ModifierPicker from '$lib/components/ModifierPicker.svelte'
    import QuestionForm from '$lib/components/QuestionForm.svelte'
    import { FACEDOWN_ADVISER_LABEL, PLAY_LABELS } from '$lib/model/adviserPlacements.js'
    import { cardChoices, toggleSingle } from '$lib/model/cardChoice.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { cardName, listed } from '$lib/model/names.js'
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
    // From revision 32: the Search's cards acting on the play or discard, and Forced Labor's toll.
    let rows = $derived(draft.visionRows)
    let tolls = $derived(draft.visionTolls)
    let unpaid = $derived(draft.visionTollsUnpaid)
    // The plays are equal choices, one width; a play the engine refuses is not offered.
    const width = new ChoiceWidth()
</script>

<QuestionForm cardId={question.visionCardId}>
    {#snippet line()}{#if unpaid.length > 0}No favor for {listed(unpaid.map(cardName))}: discard
            {cardName(question.visionCardId)}.{:else}Play {cardName(question.visionCardId)}, or
            discard it?{/if}{/snippet}
    {#if rows}
        <ModifierPicker {rows} tagUnder spacing="mb-2" />
    {/if}
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
    <!-- The plays wait for each card in use to have its picks (Bracken's pile and side). -->
    {#if draft.visionRowsComplete}
        <div class="flex flex-wrap gap-1.5">
            {#each draft.visionPlays as play (play)}
                <MenuChoice
                    label={LABELS[play]}
                    disabled={busy}
                    {width}
                    onclick={() => draft.playVision(play)}
                >
                    <span>{LABELS[play]}</span>
                    {#if tolls.length > 0}
                        <!-- R-7.1.4 — the toll under the word, in gold, as the Search menu's rows carry their cost. -->
                        <span class="text-xs font-normal" data-vision-toll
                            >{#each tolls as toll (toll.cardId)}{#if toll.payeeId}<FavorTo
                                        favor={1}
                                        playerId={toll.payeeId}
                                        gold
                                    />{:else}<FavorCost count={1} /> burned{/if}{/each}</span
                        >
                    {/if}
                </MenuChoice>
            {/each}
        </div>
    {/if}
</QuestionForm>
