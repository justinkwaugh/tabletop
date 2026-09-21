<script lang="ts">
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'
    import type { StockMenuOption } from '../stock/stockActionSelection.js'
    import { fade } from 'svelte/transition'
    import { prefersReducedMotion } from 'svelte/motion'
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
    const selectedIndex = $derived(selections.findIndex((selection) => selection.selected))
</script>

{#if session.financialState.machineState === 'StockRound' && !session.financialState.result}
    <nav aria-label="Stock actions">
        {#if selections.length}<div class="selections" style:--segments={selections.length} style:--selected={selectedIndex}>
            {#if selectedIndex >= 0}<span class="thumb" aria-hidden="true" transition:fade={{ duration: prefersReducedMotion.current ? 0 : 150 }}></span>{/if}
            {#each selections as selection (selection.label)}<button {disabled} aria-pressed={selection.selected ?? false} onclick={selection.onSelect}>{selection.label}</button>{/each}
        </div>{/if}
        {#if session.validActionTypes.includes('FinishStockTurn')}
            <button class="commit" {disabled} onclick={() => session.finishTurn()}>{session.financialState.stockRound.turn.acted ? 'End turn' : 'Pass'}</button>
        {/if}
    </nav>
{/if}

<style>
    nav { display: grid; grid-template-columns: minmax(88px, 1fr) minmax(0, auto) minmax(88px, 1fr); align-items: center; min-width: 0; flex: none; padding-block: 6px; background: var(--rail-table-background, #18212b); border-bottom: 1px solid var(--rail-border, #cbbcad); }
    .selections { grid-column: 2; position: relative; display: grid; grid-template-columns: repeat(var(--segments), minmax(0, 1fr)); min-width: 0; padding: 2px; border-radius: 999px; background: var(--rail-surface, #222c37); }
    button { position: relative; border: 0; padding: 4px clamp(10px, 2vw, 22px); border-radius: 999px; background: transparent; color: var(--rail-muted, #7f8e9e); font: inherit; font-size: 12px; line-height: 16px; text-transform: uppercase; letter-spacing: .06em; white-space: nowrap; cursor: pointer; transition: color 180ms ease; }
    .selections button:hover:not(:disabled) { color: var(--rail-text, #e3e9ef); }
    .selections button[aria-pressed='true'] { color: #ffffff; font-weight: 600; }
    .thumb { position: absolute; top: 2px; bottom: 2px; left: 2px; width: calc((100% - 4px) / var(--segments)); border-radius: 999px; background: var(--rail-solid, #40576b); transform: translateX(calc(var(--selected) * 100%)); transition: transform 180ms ease; }
    button.commit { grid-column: 3; justify-self: end; margin: 0 8px; border-radius: 6px; background: var(--rail-solid, #40576b); color: #ffffff; font-weight: 600; }
    button.commit:hover:not(:disabled) { background: var(--rail-surface-selected, #3a4c5e); }
    @media (max-width: 600px) {
        nav { grid-template-columns: minmax(64px, 1fr) minmax(0, auto) minmax(64px, 1fr); }
        button { padding-inline: 8px; font-size: 11px; }
        button.commit { margin-inline: 3px; }
    }
    @media (prefers-reduced-motion: reduce) {
        button, .thumb { transition: none; }
    }
    button:disabled { opacity: .45; cursor: default; }
    button:focus-visible { outline: 2px solid var(--rail-focus, #b8cddd); outline-offset: 1px; }
</style>
