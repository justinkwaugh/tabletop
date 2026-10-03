<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { FINAL_ROUND, powerKey, type LegalPowerUse } from '@tabletop/oath'
    import { PlayerName } from '@tabletop/frontend-components'
    import SuitPicker from '$lib/components/SuitPicker.svelte'
    import Magnifier from '$lib/components/Magnifier.svelte'
    import { cardImage } from '$lib/images/cardImages.js'
    import { suitImage } from '$lib/images/suitImages.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardName, humanizeReason, suitName } from '$lib/model/names.js'

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
    let rows = $derived(draft.rows)
</script>

{#if draft.turnFlow}
    <div>
        <h3 class="text-[11px] uppercase tracking-[0.2em] text-oath-heading mb-1">Rest Phase</h3>
        <p class="mb-2 text-sm text-oath-text-muted">
            Your Supply has refreshed. Rest powers, once each:
        </p>
        <div class="mb-2 flex flex-col gap-1.5" role="list" aria-label="Rest powers">
            {#each rows as row (powerKey(row.cardId, row.powerIndex))}
                {@const name = cardName(row.cardId)}
                <div
                    role="listitem"
                    class="rest-row flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-md px-2 py-1.5 {row.used
                        ? 'rest-row--used border border-dashed border-oath-divider'
                        : 'bg-oath-surface-raised'}"
                >
                    <span class="relative shrink-0">
                        <img class="h-10 w-auto rounded" src={cardImage(row.cardId)} alt={name} />
                        <Magnifier preview={{ cardId: row.cardId, label: name }} label={name} />
                    </span>
                    <span class="rest-row__name min-w-0">
                        <span class="block text-[15px] font-bold">{name}</span>
                        <span class="block text-xs text-oath-text-muted">
                            {#if row.used}<TokenText text={row.used} />{:else}{row.does}{/if}
                        </span>
                    </span>
                    {#if !row.used}
                        <span class="rest-buttons">
                            {#if row.banks}
                                {#each row.banks as bank (bank.suit)}
                                    <button
                                        type="button"
                                        class="rest-button"
                                        disabled={busy || !bank.enabled}
                                        aria-label="{suitName(
                                            bank.suit
                                        )} bank: take {bank.takes} favor, {bank.inBank} in bank"
                                        onclick={() => draft.useWithBank(row, bank.suit)}
                                    >
                                        <span
                                            class="flex items-center gap-1 text-[15px] font-semibold"
                                        >
                                            <img
                                                class="h-4 w-4"
                                                src={suitImage(bank.suit)}
                                                alt={suitName(bank.suit)}
                                            />
                                            <TokenText text="{bank.takes} favor" />
                                        </span>
                                        <span class="text-[11px] text-oath-text-muted"
                                            >{bank.inBank} in bank</span
                                        >
                                    </button>
                                {/each}
                            {:else}
                                <button
                                    type="button"
                                    class="rest-button"
                                    disabled={busy || !row.enabled}
                                    onclick={() => draft.useAlone(row)}
                                >
                                    <span class="text-[15px] font-semibold">
                                        <TokenText text="{row.gain.count} {row.gain.token}" />
                                    </span>
                                    {#if row.fromPlayerId}
                                        <span class="text-[11px] text-oath-text-muted"
                                            >from <PlayerName playerId={row.fromPlayerId} /></span
                                        >
                                    {/if}
                                </button>
                            {/if}
                        </span>
                    {/if}
                </div>
            {/each}
        </div>
        <button
            class="w-full rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40
                   px-2 py-1.5 text-sm font-semibold"
            disabled={busy || !!blockedBecause}
            onclick={() => gameSession.completeRest()}
        >
            End your turn
        </button>
    </div>
{:else}
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
            <p class="mb-2 text-[11px] text-oath-danger">
                <TokenText text={blockedBecause ?? ''} />
            </p>
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
{/if}

<style>
    .rest-row__name {
        width: 14rem;
    }
    .rest-row--used {
        opacity: 0.6;
    }
    .rest-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }
    .rest-button {
        width: 80px;
        height: 48px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        border: 1px solid var(--oath-frame);
        background: var(--oath-surface);
    }
    .rest-button:hover:not(:disabled) {
        border-color: var(--oath-accent);
        background: var(--oath-accent-soft);
    }
    .rest-button:disabled {
        opacity: 0.4;
    }
    @media (max-width: 639px) {
        .rest-row__name {
            width: auto;
            flex-basis: calc(100% - 3.5rem);
        }
        .rest-buttons {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            flex-basis: 100%;
        }
        .rest-button {
            width: auto;
        }
    }
</style>
