<script lang="ts">
    import { TradeOption } from '@tabletop/oath'
    import MenuChoice from '$lib/components/MenuChoice.svelte'
    import MenuCount from '$lib/components/MenuCount.svelte'
    import MenuRow from '$lib/components/MenuRow.svelte'
    import { suitImage } from '$lib/images/suitImages.js'
    import { favorToken, secretToken } from '$lib/images/tileImages.js'
    import { cardName, plural, suitName } from '$lib/model/names.js'
    import type { TradeChoice, TradeRow } from '$lib/model/tradeRows.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-5.3.2 — a row per card at the site, a button per trade the engine accepts.
    let gameSession = getGameSession()
    let rows = $derived(gameSession.tradeRows)
    let busy = $derived(gameSession.busy)

    function spoken(row: TradeRow, choice: TradeChoice): string {
        const card = cardName(row.cardId)
        return choice.option === TradeOption.ForFavor
            ? `Trade with ${card}: pay ${plural(choice.pay, 'secret')}, get ${choice.gain} favor from the ${suitName(row.suit)} bank`
            : `Trade with ${card}: pay ${choice.pay} favor, get ${plural(choice.gain, 'secret')}`
    }
</script>

<div class="flex flex-col gap-1.5" role="list" aria-label="Trades at your site">
    {#each rows as row (row.cardId)}
        <MenuRow
            image={suitImage(row.suit)}
            imageAlt={suitName(row.suit)}
            name={cardName(row.cardId)}
            points={{ kind: 'card', cardId: row.cardId }}
        >
            {#each row.choices as choice (choice.option)}
                {@const forFavor = choice.option === TradeOption.ForFavor}
                <MenuChoice
                    label={spoken(row, choice)}
                    disabled={busy}
                    onclick={() => gameSession.chooseTrade(row.cardId, choice.option)}
                >
                    <span class="flex items-center gap-1.5">
                        <MenuCount
                            count={choice.pay}
                            image={forFavor ? secretToken() : favorToken()}
                        />
                        <span class="text-oath-text-muted">→</span>
                        <MenuCount
                            count={choice.gain}
                            image={forFavor ? favorToken() : secretToken()}
                        />
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
                </MenuChoice>
            {/each}
        </MenuRow>
    {/each}
</div>
