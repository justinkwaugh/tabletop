<script lang="ts">
    import { TradeOption } from '@tabletop/oath'
    import { suitImage } from '$lib/images/suitImages.js'
    import { favorTokenImage, secretTokenImage } from '$lib/images/tileImages.js'
    import { cardName, plural, suitName } from '$lib/model/names.js'
    import type { TradeChoice, TradeRow } from '$lib/model/tradeRows.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-5.3.2 — a row per card at the site, a button per trade the engine accepts.
    let gameSession = getGameSession()
    let rows = $derived(gameSession.tradeRows)
    let marked = $derived(gameSession.tradeCard)
    let busy = $derived(gameSession.busy)

    function spoken(row: TradeRow, choice: TradeChoice): string {
        const card = cardName(row.cardId)
        return choice.option === TradeOption.ForFavor
            ? `Trade with ${card}: pay ${plural(choice.pay, 'secret')}, get ${choice.gain} favor from the ${suitName(row.suit)} bank`
            : `Trade with ${card}: pay ${choice.pay} favor, get ${plural(choice.gain, 'secret')}`
    }
</script>

{#snippet count(n: number, image: string)}
    <span class="inline-flex items-center gap-1 whitespace-nowrap">
        <span class={n === 0 ? 'text-oath-text-muted' : ''}>{n}</span>
        <img class="h-[18px] w-[18px]" src={image} alt="" />
    </span>
{/snippet}

<div class="flex flex-col gap-1.5" role="list" aria-label="Trades at your site">
    {#each rows as row (row.cardId)}
        <div
            role="listitem"
            class="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-md bg-oath-surface-raised px-2 py-1.5"
            class:ring-2={marked === row.cardId}
            class:ring-oath-accent={marked === row.cardId}
        >
            <img class="h-8 w-8 shrink-0" src={suitImage(row.suit)} alt={suitName(row.suit)} />
            <span class="min-w-0 flex-1 text-[15px] font-bold max-sm:basis-[calc(100%-3rem)]"
                >{cardName(row.cardId)}</span
            >
            <span class="flex gap-1.5 max-sm:basis-full">
                {#each row.choices as choice (choice.option)}
                    {@const forFavor = choice.option === TradeOption.ForFavor}
                    <button
                        type="button"
                        class="flex min-w-[8.5rem] flex-col items-center rounded-md border border-oath-frame
                               bg-oath-surface px-2.5 py-1.5 text-[15px] font-semibold
                               hover:border-oath-accent hover:bg-oath-accent-soft disabled:opacity-40
                               max-sm:min-w-0 max-sm:flex-1"
                        disabled={busy}
                        title={spoken(row, choice)}
                        aria-label={spoken(row, choice)}
                        onclick={() => gameSession.chooseTrade(row.cardId, choice.option)}
                    >
                        <span class="flex items-center gap-1.5">
                            {@render count(choice.pay, forFavor ? secretTokenImage() : favorTokenImage())}
                            <span class="text-oath-text-muted">→</span>
                            {@render count(choice.gain, forFavor ? favorTokenImage() : secretTokenImage())}
                        </span>
                        {#if forFavor && choice.bankShort}
                            <!-- R-9.3 — the bank gives what it holds. -->
                            <span class="text-xs font-normal text-oath-text-muted"
                                >{choice.gain === 0 ? 'bank empty' : 'bank runs short'}</span
                            >
                        {:else if !forFavor && choice.gain === 0 && choice.matchingAdvisers === 0}
                            <span
                                class="inline-flex items-center gap-1 whitespace-nowrap text-xs font-normal text-oath-text-muted"
                            >
                                no faceup
                                <img
                                    class="h-4 w-4"
                                    src={suitImage(row.suit)}
                                    alt={suitName(row.suit)}
                                />
                                adviser
                            </span>
                        {/if}
                    </button>
                {/each}
            </span>
        </div>
    {/each}
</div>
