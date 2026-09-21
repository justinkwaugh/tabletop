<script lang="ts">
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'
    import type { StockMenuOption } from '../stock/stockActionSelection.js'
    import SlidingToggle from './SlidingToggle.svelte'
    let { session, additionalActions = [] }: {
        session: FinanceExampleSession
        additionalActions?: readonly StockMenuOption[]
    } = $props()
    const disabled = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory ||
        !session.myPlayer || !session.financialState.activePlayerIds.includes(session.myPlayer.id))
    const purchase = $derived(session.purchaseChoices.find((choice) => choice.result.details && choice.certificate.kind === 'share'))
    const start = $derived(session.startChoices.find((choice) => choice.prices.some((price) => price.result.details)))
    const selections = $derived<StockMenuOption[]>([
        ...(purchase ? [{ label: 'Buy', selected: session.stockMenu === 'buy', onSelect: () => session.chooseStockMenu('buy', purchase.request.buyer) }] : []),
        ...(session.saleChoices.some((choice) => choice.result.details) ? [{ label: 'Sell', selected: session.stockMenu === 'sell', onSelect: () => session.chooseStockMenu('sell') }] : []),
        ...(start ? [{ label: 'Start', selected: session.stockMenu === 'start', onSelect: () => session.chooseStockMenu('start', start.request.buyer) }] : []),
        ...(session.privateExchangeOffers.length ? [{ label: 'Exchange', selected: session.stockMenu === 'exchange', onSelect: () => session.chooseStockMenu('exchange') }] : []),
        ...additionalActions
    ])
    let stripWidth = $state(0)
    let selectionsWidth = $state(0)
    let turnActionWidth = $state(0)
    const compact = $derived(selectionsWidth + 2 * turnActionWidth > stripWidth)
    const selectedIndex = $derived(selections.findIndex((selection) => selection.selected))
</script>

{#if session.financialState.machineState === 'StockRound' && !session.financialState.result}
    <nav aria-label="Stock actions" bind:clientWidth={stripWidth} class:compact>
        {#if selections.length}<div class="selections" bind:offsetWidth={selectionsWidth}>
            <SlidingToggle count={selections.length} {selectedIndex}>
            {#each selections as selection (selection.label)}<button {disabled} aria-pressed={selection.selected ?? false} onclick={selection.onSelect}>{selection.label}</button>{/each}
            </SlidingToggle>
        </div>{/if}
        <div class="turn-action" bind:offsetWidth={turnActionWidth}>
            {#if session.validActionTypes.includes('FinishStockTurn')}
                <button class="commit" {disabled} onclick={() => session.finishTurn()}>{session.financialState.stockRound.turn.acted ? 'End turn' : 'Pass'}</button>
            {/if}
        </div>
    </nav>
{/if}

<style>
    nav { position: sticky; top: 0; z-index: 10; display: grid; grid-template-columns: minmax(0, 1fr) max-content minmax(0, 1fr); align-items: center; min-width: 0; flex: none; padding-block: 6px; background: var(--rail-table-background, #18212b); border-bottom: 1px solid var(--rail-border, #cbbcad); }
    .selections { grid-column: 2; justify-self: center; width: max-content; min-width: 0; }
    button { position: relative; border: 0; padding: 4px clamp(10px, 2vw, 22px); border-radius: 999px; background: transparent; color: var(--rail-muted, #7f8e9e); font: inherit; font-size: 12px; line-height: 16px; text-transform: uppercase; letter-spacing: .06em; white-space: nowrap; cursor: pointer; transition: color 180ms ease; }
    .selections button:hover:not(:disabled) { color: var(--rail-text, #e3e9ef); }
    .selections button[aria-pressed='true'] { color: #ffffff; font-weight: 600; }
    .turn-action { grid-column: 3; justify-self: end; display: flex; }
    nav.compact { grid-template-columns: minmax(0, 1fr) max-content; }
    .compact .selections { grid-column: 1; }
    .compact .turn-action { grid-column: 2; }
    button.commit { margin: 0 8px; border-radius: 6px; background: var(--rail-solid, #40576b); color: #ffffff; font-weight: 600; }
    button.commit:hover:not(:disabled) { background: var(--rail-surface-selected, #3a4c5e); }
    @media (max-width: 600px) {
        button { padding-inline: 8px; font-size: 11px; }
        button.commit { margin-inline: 3px; }
    }
    @media (prefers-reduced-motion: reduce) {
        button { transition: none; }
    }
    button:disabled { opacity: .45; cursor: default; }
    button:focus-visible { outline: 2px solid var(--rail-focus, #b8cddd); outline-offset: 1px; }
</style>
