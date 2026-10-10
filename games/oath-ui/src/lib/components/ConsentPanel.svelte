<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import CitizenshipAnswer from '$lib/components/CitizenshipAnswer.svelte'
    import { ConsentRequestKind } from '@tabletop/oath'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { consentQuestion } from '$lib/model/consentRequests.js'

    // R-X.1 — another player's permission is explicit action input,
    // asked as a decision turn; refusing is a first-class answer.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let me = $derived(gameSession.myPlayer)
    let busy = $derived(gameSession.busy)

    let pending = $derived(gameState.pendingConsent)
    let iAmAsked = $derived(!!me && pending?.askedPlayerId === me.id)
    let asked = $derived(gameSession.consentAsked)
    let grantBlockedBecause = $derived(gameSession.consentGrantBlockedBecause)

    let request = $derived(
        pending?.request.kind === ConsentRequestKind.CitizenshipOffer ? pending.request : undefined
    )
</script>

<div>
    {#if pending && iAmAsked && request}
        <CitizenshipAnswer
            askingPlayerId={pending.askingPlayerId}
            exileId={pending.askedPlayerId}
            reliquarySlotId={request.reliquarySlotId}
            terms={request.terms}
        />
    {:else if !pending}
        <p class="text-sm text-oath-text-muted">Nothing is waiting on an answer.</p>
    {:else if !iAmAsked}
        <p class="text-sm text-oath-text-muted">
            Waiting on <PlayerName playerId={pending.askedPlayerId} />.
        </p>
    {:else if asked}
        <h3 class="text-[11px] uppercase tracking-[0.2em] text-oath-heading mb-2">
            A question for you
        </h3>
        <p class="text-sm mb-2">
            {consentQuestion(gameState, asked, (id) => gameSession.getPlayerName(id))}
        </p>
        {#if grantBlockedBecause}
            <p class="mb-2 text-[11px] text-oath-danger">
                {gameSession.humanizeReason(grantBlockedBecause)}
            </p>
        {/if}
        <div class="answers gap-2">
            <button
                class="rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40
                       border-[1.5px] border-oath-primary-border px-3 py-1.5 text-sm font-semibold"
                disabled={busy || !!grantBlockedBecause}
                onclick={() => gameSession.answerConsent(true)}
            >
                {asked.request.kind === ConsentRequestKind.JoinDefence ? 'Join' : 'Allow'}
            </button>
            <button
                class="rounded bg-oath-control hover:bg-oath-control-hover disabled:opacity-40
                       px-3 py-1.5 text-sm font-semibold"
                disabled={busy}
                onclick={() => gameSession.answerConsent(false)}
            >
                {asked.request.kind === ConsentRequestKind.JoinDefence ? 'Stay out' : 'Refuse'}
            </button>
        </div>
    {/if}
</div>

<style>
    /* The two answers are as wide as the longer label at every width, 44 px tall on a phone. */
    .answers {
        display: inline-grid;
        grid-auto-flow: column;
        grid-auto-columns: 1fr;
    }
    @media (max-width: 639px) {
        .answers button {
            min-height: 44px;
        }
    }
</style>
