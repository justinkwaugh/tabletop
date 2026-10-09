<script lang="ts">
    import CitizenshipAnswer from '$lib/components/CitizenshipAnswer.svelte'
    import TokenText from '$lib/components/TokenText.svelte'
    import WaitingOn from '$lib/components/WaitingOn.svelte'
    import { PlayerName } from '@tabletop/frontend-components'
    import { ConsentRequestKind, IMPERIAL_WARBANDS } from '@tabletop/oath'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { WarbandWhose } from '$lib/model/tokenText.js'
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
    let question = $derived(
        asked && consentQuestion(gameState, asked, (id) => gameSession.getPlayerName(id))
    )
    // R-10.13 — the warbands asked about are their owner's pieces, an Imperial phrase the Empire's.
    let warbandColor = $derived.by(() => {
        if (asked?.request.kind !== ConsentRequestKind.WarbandMove) return undefined
        const own = gameSession.warbandColor(asked.request.owner)
        const imperial = gameSession.warbandColor(IMPERIAL_WARBANDS)
        return (whose: WarbandWhose) => (whose.kind === 'imperial' ? imperial : own)
    })

    let request = $derived(
        pending?.request.kind === ConsentRequestKind.CitizenshipOffer ? pending.request : undefined
    )
</script>

{#snippet heading(text: string)}
    <h3 class="text-[11px] uppercase tracking-[0.2em] text-oath-heading mb-2">{text}</h3>
{/snippet}

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
        <WaitingOn />
    {:else if asked && question}
        {@render heading(question.heading)}
        <p class="text-sm mb-2">
            {#each question.parts as part, i (i)}{#if part.kind === 'seat'}<PlayerName
                        playerId={part.playerId}
                    />{:else}<TokenText text={part.text} {warbandColor} />{/if}{/each}
        </p>
        <!-- Rule 1 — a move the board no longer allows has no Allow; the engine's reason says why. -->
        {#if grantBlockedBecause}
            <p class="mb-2 text-[11px] text-oath-danger">
                <TokenText text={gameSession.humanizeReason(grantBlockedBecause) ?? ''} />
            </p>
        {/if}
        <div class="answers gap-2">
            {#if !grantBlockedBecause}
                <button
                    class="rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40
                           border-[1.5px] border-oath-primary-border px-3 py-1.5 text-sm font-semibold"
                    disabled={busy}
                    onclick={() => gameSession.answerConsent(true)}
                >
                    {asked.request.kind === ConsentRequestKind.JoinDefence ? 'Join' : 'Allow'}
                </button>
            {/if}
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
