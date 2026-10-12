<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import AnswerButton from '$lib/components/AnswerButton.svelte'
    import DiscardOrderCards from '$lib/components/DiscardOrderCards.svelte'
    import QuestionForm from '$lib/components/QuestionForm.svelte'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // Law Glossary "Discard" — the cards go down in the order the player taps them.
    let gameSession = getGameSession()
    let draft = $derived(gameSession.question)
    let busy = $derived(gameSession.busy)
    let refused = $derived(draft.stackBlockedBecause)
    const width = new ChoiceWidth()
</script>

<QuestionForm>
    {#snippet line()}Tap to discard; the last goes on top.{/snippet}
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
    <div class="flex flex-wrap gap-2">
        {#if draft.stackComplete && !refused}
            <AnswerButton primary {width} disabled={busy} onclick={() => draft.stack()}>
                Discard
            </AnswerButton>
        {/if}
    </div>
</QuestionForm>
