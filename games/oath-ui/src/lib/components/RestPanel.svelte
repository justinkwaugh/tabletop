<script lang="ts">
    import { FINAL_ROUND, powerKey, type LegalPowerUse, type Suit } from '@tabletop/oath'
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
    function pickBank(p: LegalPowerUse, value: string) {
        const suit = draft.bankOptions(p).find((bank: Suit) => bank === value)
        if (suit !== undefined) draft.pickBank(p, suit)
    }

    let rollsEndDie = $derived(draft.rollsEndDie)
    let blockedBecause = $derived(draft.completeBlockedBecause)
</script>

<div class="rounded-lg bg-stone-900/70 border border-amber-500/40 px-3 py-2 text-stone-100">
    <h3 class="text-[11px] uppercase tracking-[0.2em] text-amber-200/80 mb-2">Rest Phase</h3>

    <p class="text-sm mb-2">Your Supply refreshes and your turn ends.</p>

    {#if draft.powers.length > 0}
        <div class="mb-2 rounded border border-amber-500/40 px-2 py-1.5 text-xs">
            <div class="mb-1">Rest powers you may use, once each:</div>
            {#each draft.powers as p (powerKey(p.cardId, p.powerIndex))}
                {@const banks = draft.bankOptions(p)}
                {@const reason = reasonFor(p)}
                <div class="mb-1 flex items-center gap-2">
                    <span class="grow">
                        <span class="font-semibold">{cardName(p.cardId)}</span>
                    </span>
                    {#if banks.length > 0}
                        <select
                            disabled={busy}
                            class="rounded bg-stone-800 px-1 py-0.5 text-xs"
                            value={draft.pickedSuit(p)}
                            onchange={(event) => pickBank(p, event.currentTarget.value)}
                        >
                            {#each banks as suit (suit)}
                                <option value={suit}>{suit} bank</option>
                            {/each}
                        </select>
                    {/if}
                    <button
                        class="rounded bg-amber-700 hover:bg-amber-600 disabled:opacity-40 px-2 py-0.5"
                        disabled={busy || !!reason}
                        title={reason ?? ''}
                        onclick={() => draft.use(p)}
                    >
                        Use
                    </button>
                </div>
                {#if reason}
                    <p class="mb-1 text-[11px] text-rose-300">{humanizeReason(reason)}</p>
                {/if}
            {/each}
        </div>
    {/if}

    {#if rollsEndDie}
        <p
            class="mb-2 rounded border border-amber-400/60 bg-amber-950/40 px-2 py-1
                  text-[11px] leading-snug"
        >
            This is the last turn of round {gameState.round} of {FINAL_ROUND}, so the end die is
            rolled. The game may end here, and this cannot be undone afterwards (R-X.3).
        </p>
    {/if}

    {#if blockedBecause}
        <p class="mb-2 text-[11px] text-rose-300">{blockedBecause}</p>
    {/if}

    <button
        class="w-full rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40
               px-2 py-1.5 text-sm font-semibold"
        disabled={busy || !!blockedBecause}
        onclick={() => gameSession.completeRest()}
    >
        {rollsEndDie ? 'Rest, and roll the end die' : 'Rest, and end your turn'}
    </button>
</div>
