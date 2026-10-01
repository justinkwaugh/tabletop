<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { FINAL_ROUND, powerKey, type LegalPowerUse } from '@tabletop/oath'
    import SuitPicker from '$lib/components/SuitPicker.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardName, humanizeReason } from '$lib/model/names.js'

    // R-4.3.5, R-7.3.4 — Rest powers once each. R-X.3 — from round 5, R-3.3's end die stops undo here.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let draft = $derived(gameSession.rest)
    let busy = $derived(gameSession.busy)

    function reasonFor(p: LegalPowerUse) {
        return draft.reasonCannotUse(p)
    }

    let rollsEndDie = $derived(draft.rollsEndDie)
    let blockedBecause = $derived(draft.completeBlockedBecause)
</script>

<div>
    <h3 class="text-[11px] uppercase tracking-[0.2em] text-oath-heading mb-2">Rest Phase</h3>

    <p class="text-sm mb-2">Your Supply refreshes and your turn ends.</p>

    {#if draft.powers.length > 0}
        <div class="mb-2 border-t border-oath-divider pt-1.5 text-xs">
            <div class="mb-1">Rest powers you may use, once each:</div>
            {#each draft.powers as p (powerKey(p.cardId, p.powerIndex))}
                {@const banks = draft.bankOptions(p)}
                {@const reason = reasonFor(p)}
                <div class="mb-1 flex items-center gap-2">
                    <span class="grow">
                        <span class="font-semibold">{cardName(p.cardId)}</span>
                    </span>
                    <button
                        class="rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 px-2 py-0.5"
                        disabled={busy || !!reason}
                        title={reason ?? ''}
                        onclick={() => draft.use(p)}
                    >
                        Use
                    </button>
                </div>
                {#if banks.length > 0}
                    {@const picked = draft.pickedSuit(p)}
                    <div class="mb-1">
                        <SuitPicker
                            suits={banks}
                            picked={picked === undefined ? [] : [picked]}
                            onpick={(suit) => draft.pickBank(p, suit)}
                            {busy}
                        />
                    </div>
                {/if}
                {#if reason}
                    <p class="mb-1 text-[11px] text-oath-danger">
                        <TokenText text={humanizeReason(reason) ?? ''} />
                    </p>
                {/if}
            {/each}
        </div>
    {/if}

    {#if rollsEndDie}
        <p
            class="mb-2 rounded bg-oath-accent-soft px-2 py-1
                  text-[11px] leading-snug"
        >
            This is the last turn of round {gameState.round} of {FINAL_ROUND}, so the end die is
            rolled. The game may end here, and this cannot be undone afterwards (R-X.3).
        </p>
    {/if}

    {#if blockedBecause}
        <p class="mb-2 text-[11px] text-oath-danger"><TokenText text={blockedBecause ?? ''} /></p>
    {/if}

    <button
        class="w-full rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40
               px-2 py-1.5 text-sm font-semibold"
        disabled={busy || !!blockedBecause}
        onclick={() => gameSession.completeRest()}
    >
        {rollsEndDie ? 'Rest, and roll the end die' : 'Rest, and end your turn'}
    </button>
</div>
