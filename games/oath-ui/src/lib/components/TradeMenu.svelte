<script lang="ts">
    import { TradeOption } from '@tabletop/oath'
    import MenuChoice from '$lib/components/MenuChoice.svelte'
    import MenuCount from '$lib/components/MenuCount.svelte'
    import MenuRow from '$lib/components/MenuRow.svelte'
    import { suitImage } from '$lib/images/suitImages.js'
    import { favorToken, secretToken } from '$lib/images/tileImages.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { cardName, plural, suitName } from '$lib/model/names.js'
    import type { TradeChoice, TradeRow } from '$lib/model/tradeRows.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-5.3.2 — a row per card at the site, a button per trade the engine accepts.
    let gameSession = getGameSession()
    let rows = $derived(gameSession.tradeRows)
    let busy = $derived(gameSession.busy)
    const choiceWidth = new ChoiceWidth()

    function spoken(row: TradeRow, choice: TradeChoice): string {
        const card = cardName(row.cardId)
        if (choice.option === TradeOption.ForFavor) {
            return `Trade with ${card}: pay ${plural(choice.pay, 'secret')}, get ${choice.gain} favor from the ${suitName(row.suit)} bank`
        }
        const beside = choice.sideFavor > 0 ? ` and ${choice.sideFavor} favor` : ''
        return `Trade with ${card}: pay ${choice.pay} favor, get ${plural(choice.gain, 'secret')}${beside}`
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
                    width={choiceWidth}
                    onclick={() => gameSession.chooseTrade(row.cardId, choice.option)}
                >
                    <span class="flex items-center gap-1.5">
                        <MenuCount
                            count={choice.pay}
                            image={forFavor ? secretToken() : favorToken()}
                            cost
                        />
                        <span class="text-oath-text-muted">→</span>
                        <MenuCount
                            count={choice.gain}
                            image={forFavor ? favorToken() : secretToken()}
                        />
                        {#if choice.sideFavor > 0}
                            <span class="text-oath-text-muted">+</span>
                            <MenuCount count={choice.sideFavor} image={favorToken()} />
                        {/if}
                    </span>
                </MenuChoice>
            {/each}
        </MenuRow>
    {/each}
</div>
