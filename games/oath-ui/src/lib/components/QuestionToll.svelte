<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { PowerQuestionKind, type QuestionOf } from '@tabletop/oath'
    import FavorCost from '$lib/components/FavorCost.svelte'
    import QuestionForm from '$lib/components/QuestionForm.svelte'
    import QuestionYesNo from '$lib/components/QuestionYesNo.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // Toll Roads — the moved player pays the toll (to the Chancellor for the Empire, burned for the
    // bandits) or refuses; who moved them, and where, is the History's. The answers are the
    // question's own: one width, 44 px tall on a phone, Pay shown only while the engine allows it.
    let { question }: { question: QuestionOf<PowerQuestionKind.PayTravelToll> } = $props()

    let gameSession = getGameSession()
    let payee = $derived(question.payeeId)
    // R-10.4 — an Imperial ruler's toll goes to the Chancellor.
    let toChancellor = $derived(
        payee !== undefined && payee === gameSession.gameState.chancellorId()
    )
</script>

<QuestionForm cardId={question.cardId}>
    {#snippet line()}{#if payee}Pay <PlayerName playerId={payee} />{:else}Burn{/if}
        <FavorCost count={1} />?{#if toChancellor}{' '}(the Chancellor){/if}{/snippet}
    <QuestionYesNo yes={payee ? 'Pay' : 'Burn'} no="Refuse" />
</QuestionForm>
