<script lang="ts">
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'
    import type { StockMenuOption } from '../stock/stockActionSelection.js'
    let { session, additionalActions = [] }: {
        session: FinanceExampleSession
        additionalActions?: readonly StockMenuOption[]
    } = $props()
    const disabled = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory ||
        !session.myPlayer || !session.financialState.activePlayerIds.includes(session.myPlayer.id))
    const purchase = $derived(session.purchaseChoices.find((choice) => choice.result.details && choice.certificate.kind === 'share'))
    const start = $derived(session.startChoices.find((choice) => choice.prices.some((price) => price.result.details)))
</script>

{#if session.financialState.machineState === 'StockRound' && !session.financialState.result}
    <nav aria-label="Stock actions">
        <div class="selections">
            {#if purchase}<button {disabled} aria-pressed={session.stockMenu === 'buy'} onclick={() => session.chooseStockMenu('buy', purchase.request.buyer)}>Buy</button>{/if}
            {#if session.saleChoices.some((choice) => choice.result.details)}<button {disabled} aria-pressed={session.stockMenu === 'sell'} onclick={() => session.chooseStockMenu('sell')}>Sell</button>{/if}
            {#if start}<button {disabled} aria-pressed={session.stockMenu === 'start'} onclick={() => session.chooseStockMenu('start', start.request.buyer)}>Start</button>{/if}
            {#if session.privateExchangeOffers.length}<button {disabled} aria-pressed={session.stockMenu === 'exchange'} onclick={() => session.chooseStockMenu('exchange')}>Exchange</button>{/if}
            {#each additionalActions as action}<button {disabled} aria-pressed={action.selected ?? false} onclick={action.onSelect}>{action.label}</button>{/each}
        </div>
        {#if session.validActionTypes.includes('FinishStockTurn')}
            <button class="commit" {disabled} onclick={() => session.finishTurn()}>{session.financialState.stockRound.turn.acted ? 'End turn' : 'Pass'}</button>
        {/if}
    </nav>
{/if}

<style>
    nav { display: grid; grid-template-columns: minmax(88px, 1fr) minmax(0, auto) minmax(88px, 1fr); align-items: center; min-width: 0; flex: none; background: #e8ded4; border-bottom: 1px solid #cbbcad; }
    .selections { grid-column: 2; display: flex; justify-content: safe center; gap: 5px; min-width: 0; overflow-x: auto; padding: 4px 8px; }
    button { position: relative; flex: none; border: 0; padding: 6px clamp(12px, 2vw, 24px); border-radius: 4px; background: #faf6ef; color: #625243; font: inherit; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; cursor: pointer; }
    button:hover:not(:disabled):not([aria-pressed='true']) { background: #e5d9c8; }
    button[aria-pressed='true'] { background: #695543; color: #fffaf3; }
    button.commit { grid-column: 3; justify-self: end; margin: 4px 8px; background: #695540; color: #fffaf4; }
    button.commit:hover:not(:disabled) { background: #51412f; }
    @media (max-width: 600px) {
        nav { grid-template-columns: minmax(64px, 1fr) minmax(0, auto) minmax(64px, 1fr); }
        .selections { gap: 3px; padding-inline: 3px; }
        button { padding-inline: 7px; font-size: 11px; }
        button.commit { margin-inline: 3px; }
    }
    button:disabled { opacity: .45; cursor: default; }
    button:focus-visible { outline: 2px solid #a87948; outline-offset: -3px; }
</style>
