<script lang="ts">
    import { PowerQuestionKind, type QuestionOf } from '@tabletop/oath'
    import CardImage from '$lib/components/CardImage.svelte'
    import FavorCost from '$lib/components/FavorCost.svelte'
    import { cardName } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { question }: { question: QuestionOf<PowerQuestionKind.PayTravelToll> } = $props()

    let gameSession = getGameSession()
    let draft = $derived(gameSession.question)
    let busy = $derived(gameSession.busy)
    let payee = $derived(question.payeeId)
    // R-10.4 — an Imperial ruler's toll goes to the Chancellor.
    let toChancellor = $derived(
        payee !== undefined && payee === gameSession.gameState.chancellorId()
    )
</script>

<div class="flex items-start gap-3">
    <CardImage cardId={question.cardId} width={40} label={cardName(question.cardId)} inspect />
    <div class="min-w-0 grow">
        <p class="mb-2 text-base">
            {#if payee}Pay {gameSession.getPlayerName(payee)}{:else}Burn{/if}
            <FavorCost count={1} />?{#if toChancellor}{' '}(the Chancellor){/if}
        </p>
        <div class="inline-grid grid-flow-col auto-cols-fr gap-2 max-sm:grid max-sm:w-full">
            <button
                class="rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 px-4 py-2 text-base font-semibold"
                disabled={busy || !!draft.acceptRefusedBecause}
                onclick={() => draft.accept()}
            >
                {payee ? 'Pay' : 'Burn'}
            </button>
            <button
                class="rounded bg-oath-control hover:bg-oath-control-hover disabled:opacity-40 px-4 py-2 text-base font-semibold"
                disabled={busy}
                onclick={() => draft.decline()}
            >
                Refuse
            </button>
        </div>
    </div>
</div>
