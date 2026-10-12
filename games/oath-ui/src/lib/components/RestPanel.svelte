<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { powerKey, type LegalPowerUse } from '@tabletop/oath'
    import { PlayerName } from '@tabletop/frontend-components'
    import SuitPicker from '$lib/components/SuitPicker.svelte'
    import Magnifier from '$lib/components/Magnifier.svelte'
    import { cardImage } from '$lib/images/cardImages.js'
    import { cardAspect } from '$lib/images/cardShape.js'
    import { suitImage } from '$lib/images/suitImages.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardName, suitName } from '$lib/model/names.js'

    // R-4.3.5, R-7.3.4 — Rest powers once each: a power already used this Rest is not listed.
    let gameSession = getGameSession()
    let draft = $derived(gameSession.rest)
    let busy = $derived(gameSession.busy)

    function reasonFor(p: LegalPowerUse) {
        return draft.reasonCannotUse(p)
    }

    let rollsEndDie = $derived(draft.rollsEndDie)
    let blockedBecause = $derived(draft.completeBlockedBecause)
    let rows = $derived(draft.rows)

    const buttonWidth = new ChoiceWidth()
</script>

{#if draft.turnFlow}
    <div>
        <div class="rest-rows mb-2" role="list" aria-label="Rest powers">
            {#each rows as row (powerKey(row.cardId, row.powerIndex))}
                {@const name = cardName(row.cardId)}
                <div role="listitem" class="rest-row rounded-md bg-oath-surface-raised px-2 py-1.5">
                    <span class="relative shrink-0">
                        <img
                            class="h-10 rounded"
                            style:aspect-ratio={cardAspect({ cardId: row.cardId })}
                            src={cardImage(row.cardId)}
                            alt={name}
                        />
                        <Magnifier preview={{ cardId: row.cardId, label: name }} label={name} />
                    </span>
                    <span class="text-[15px] font-bold">{name}</span>
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
                                        class="flex justify-center"
                                        style:min-width="{buttonWidth.widest}px"
                                    >
                                        <span
                                            class="flex w-max items-center gap-1 text-[15px] font-semibold"
                                            {@attach buttonWidth.measure}
                                        >
                                            <img
                                                class="h-4 w-4"
                                                src={suitImage(bank.suit)}
                                                alt={suitName(bank.suit)}
                                            />
                                            <TokenText text="{bank.takes} favor" />
                                        </span>
                                    </span>
                                </button>
                            {/each}
                        {:else}
                            <button
                                type="button"
                                class="rest-button"
                                disabled={busy || !row.enabled}
                                onclick={() => draft.useAlone(row)}
                            >
                                <span
                                    class="flex justify-center"
                                    style:min-width="{buttonWidth.widest}px"
                                >
                                    <span
                                        class="flex w-max flex-col items-center"
                                        {@attach buttonWidth.measure}
                                    >
                                        <span class="text-[15px] font-semibold">
                                            <TokenText text="{row.gain.count} {row.gain.token}" />
                                        </span>
                                        {#if row.fromPlayerId}
                                            <span class="text-[11px] text-oath-text-muted"
                                                >from <PlayerName
                                                    playerId={row.fromPlayerId}
                                                /></span
                                            >
                                        {/if}
                                    </span>
                                </span>
                            </button>
                        {/if}
                    </span>
                </div>
            {/each}
        </div>
        <button
            class="min-h-11 rounded bg-oath-primary border-[1.5px] border-oath-primary-border px-4 py-1.5 text-[15px] font-semibold
                   text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40"
            disabled={busy || !!blockedBecause}
            onclick={() => gameSession.completeRest()}
        >
            End Rest Phase
        </button>
    </div>
{:else}
    <div>
        {#if draft.powers.length > 0}
            <div class="mb-2 text-xs">
                {#each draft.powers as p (powerKey(p.cardId, p.powerIndex))}
                    {@const banks = draft.bankOptions(p)}
                    {@const reason = reasonFor(p)}
                    {@const bankPicked = draft.bankPicked(p)}
                    <div class="mb-1 flex items-center gap-2">
                        <span class="grow">
                            <span class="font-semibold">{cardName(p.cardId)}</span>
                        </span>
                        {#if bankPicked}
                            <button
                                class="min-h-8 rounded bg-oath-control px-3 py-0.5 hover:bg-oath-control-hover disabled:opacity-40
                                       max-sm:min-h-11"
                                disabled={busy || !!reason}
                                title={gameSession.humanizeReason(reason) ?? ''}
                                onclick={() => draft.use(p)}
                            >
                                Use
                            </button>
                        {/if}
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
                    {#if reason && bankPicked}
                        <p class="mb-1 text-[11px] text-oath-danger">
                            <TokenText text={gameSession.humanizeReason(reason) ?? ''} />
                        </p>
                    {/if}
                {/each}
            </div>
        {/if}

        {#if blockedBecause}
            <p class="mb-2 text-[11px] text-oath-danger">
                <TokenText text={gameSession.humanizeReason(blockedBecause) ?? ''} />
            </p>
        {/if}

        <button
            class="min-h-11 rounded bg-oath-primary border-[1.5px] border-oath-primary-border px-4 py-1.5 text-[15px] font-semibold
                   text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40"
            disabled={busy || !!blockedBecause}
            onclick={() => gameSession.completeRest()}
        >
            {rollsEndDie ? 'Roll the end die' : 'End Rest Phase'}
        </button>
    </div>
{/if}

<style>
    .rest-rows {
        display: grid;
        grid-template-columns: max-content max-content minmax(0, 1fr);
        column-gap: 10px;
        row-gap: 6px;
    }
    .rest-row {
        display: grid;
        grid-column: 1 / -1;
        grid-template-columns: subgrid;
        align-items: center;
    }
    .rest-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }
    .rest-button {
        height: 48px;
        padding: 0 10px;
        display: flex;
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
        .rest-rows {
            display: flex;
            flex-direction: column;
        }
        .rest-row {
            display: flex;
            flex-wrap: wrap;
            column-gap: 10px;
            row-gap: 6px;
        }
        .rest-buttons {
            flex-basis: 100%;
        }
    }
</style>
