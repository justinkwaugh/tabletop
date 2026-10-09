<script lang="ts">
    import ConspiracyTakePicker from '$lib/components/ConspiracyTakePicker.svelte'
    import QuestionForm from '$lib/components/QuestionForm.svelte'
    import QuestionYesNo from '$lib/components/QuestionYesNo.svelte'
    import { SearchPlay } from '@tabletop/oath'
    import { PLAY_LABELS } from '$lib/model/adviserPlacements.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // Inquisitor — the card the question is about is the Conspiracy it found.
    const CONSPIRACY = 'vision.conspiracy'

    let gameSession = getGameSession()
    let draft = $derived(gameSession.question)
</script>

<QuestionForm cardId={CONSPIRACY}>
    {#snippet line()}The Conspiracy: play it, or discard it?{/snippet}
    {#if draft.takeTargets.length > 0}
        <!-- R-5.1.4.IV — burn one secret to take a relic or banner from a player at your site. -->
        <ConspiracyTakePicker
            ask="Take a relic or banner?"
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
    <QuestionYesNo yes={PLAY_LABELS[SearchPlay.Conspiracy]} no={PLAY_LABELS[SearchPlay.Discard]} />
</QuestionForm>
