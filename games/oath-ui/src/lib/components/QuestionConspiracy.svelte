<script lang="ts">
    import { PowerQuestionKind, type PowerQuestion } from '@tabletop/oath'
    import ConspiracyTakePicker from '$lib/components/ConspiracyTakePicker.svelte'
    import QuestionYesNo from '$lib/components/QuestionYesNo.svelte'
    import { cardName } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let {
        question
    }: { question: Extract<PowerQuestion, { kind: PowerQuestionKind.PlayOrDiscardConspiracy }> } =
        $props()

    let gameSession = getGameSession()
    let draft = $derived(gameSession.question)
</script>

<p class="text-sm mb-2">
    {cardName(question.cardId)}: {gameSession.getPlayerName(question.holderPlayerId)}'s adviser is
    the Conspiracy. Play it faceup (it then leaves the game), or discard it.
</p>
{#if draft.takeTargets.length > 0}
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
{/if}
<QuestionYesNo yes="Play it{draft.conspiracy ? ' and take' : ''}" no="Discard it" />
