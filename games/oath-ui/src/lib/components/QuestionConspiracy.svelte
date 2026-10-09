<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import AnswerButton from '$lib/components/AnswerButton.svelte'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import ConspiracyTakePicker from '$lib/components/ConspiracyTakePicker.svelte'
    import MenuChoice from '$lib/components/MenuChoice.svelte'
    import QuestionForm from '$lib/components/QuestionForm.svelte'
    import { SearchPlay } from '@tabletop/oath'
    import { FACEDOWN_ADVISER_LABEL, PLAY_LABELS } from '$lib/model/adviserPlacements.js'
    import { cardChoices, toggleSingle } from '$lib/model/cardChoice.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // Inquisitor — the card the question is about is the Conspiracy it found.
    const CONSPIRACY = 'vision.conspiracy'

    // R-5.1.4-H1 — the Search's labels for this card.
    const LABELS: Record<SearchPlay, string> = {
        ...PLAY_LABELS,
        [SearchPlay.Adviser]: FACEDOWN_ADVISER_LABEL
    }

    let gameSession = getGameSession()
    let draft = $derived(gameSession.question)
    let busy = $derived(gameSession.busy)
    let step = $derived(draft.conspiracyStep)
    let refused = $derived(draft.conspiracyRefusedBecause)
    // The plays are equal choices, one width; a play the engine refuses is not offered.
    const width = new ChoiceWidth()
    const confirmWidth = new ChoiceWidth()
</script>

<!-- The take and the adviser to discard come after the play that needs them, as a Search's do;
     Undo steps back to the three answers. -->
<QuestionForm cardId={CONSPIRACY}>
    {#snippet line()}{#if step === SearchPlay.Conspiracy}The Conspiracy: take a relic or banner?{:else if step === SearchPlay.Adviser}Discard
            1 adviser.{:else}The Conspiracy: how do you play it?{/if}{/snippet}
    {#if step === undefined}
        <div class="flex flex-wrap gap-1.5">
            {#each draft.conspiracyPlays as play (play)}
                <MenuChoice
                    label={LABELS[play]}
                    disabled={busy}
                    {width}
                    onclick={() => draft.chooseConspiracyPlay(play)}
                >
                    {LABELS[play]}
                </MenuChoice>
            {/each}
        </div>
    {:else}
        {#if step === SearchPlay.Conspiracy}
            <!-- R-5.1.4.IV — burn one secret to take a relic or banner from a player at your site. -->
            <ConspiracyTakePicker
                targets={draft.takeTargets}
                prizesOf={() => draft.takePrizes}
                pick={{
                    targetPlayerId: draft.takeTarget,
                    prizeIndex: draft.takePrizeIndex,
                    confirmed: false
                }}
                onchange={(pick) =>
                    pick.targetPlayerId !== draft.takeTarget
                        ? draft.chooseTakeTarget(pick.targetPlayerId)
                        : draft.chooseTakePrize(pick.prizeIndex)}
            />
        {:else}
            <!-- R-5.1.4.II — at the adviser limit it goes down over a discarded adviser. -->
            <div class="mb-2">
                <CardChoiceRow
                    choices={cardChoices(draft.conspiracyDiscards)}
                    picked={draft.conspiracyDiscard ? [draft.conspiracyDiscard] : []}
                    onpick={(cardId) =>
                        draft.chooseConspiracyDiscard(
                            toggleSingle(draft.conspiracyDiscard, cardId)
                        )}
                    {busy}
                    height={80}
                    discard
                />
            </div>
        {/if}
        <!-- "Play" once the picks are made; a red line only when the engine refuses them. -->
        {#if refused}
            <p class="mb-2 text-[11px] text-oath-danger">
                <TokenText text={gameSession.humanizeReason(refused) ?? ''} />
            </p>
        {:else if draft.conspiracyStepComplete}
            <div class="flex flex-wrap gap-2">
                <AnswerButton
                    primary
                    width={confirmWidth}
                    disabled={busy}
                    onclick={() => draft.playConspiracy()}
                >
                    Play
                </AnswerButton>
            </div>
        {/if}
    {/if}
</QuestionForm>
