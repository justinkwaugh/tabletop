<script lang="ts">
    import { companyMarketSpace, getCompany } from '@tabletop/18xx'
    import { takeLoanAction } from './cardActions.js'
    import { CompanyActionCard } from '@tabletop/18xx-ui'
    import { companyFinanceFacts } from './roundFacts.js'
    import { StockPanelHeading } from '@tabletop/18xx-ui'
    import type { EighteenSeventeenSession } from './session.svelte.js'
    let { session }: { session: EighteenSeventeenSession } = $props()
    const money = $derived(session.presentation.money)
    const gameState = $derived(session.gameState)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
    const acting = $derived(gameState.stockRound.turn.corporateAction)
</script>

<section aria-label="Corporate actions">
    <StockPanelHeading
        text={acting
            ? `Acting for ${getCompany(gameState, acting.companyId).name}`
            : 'Act for a company'}
    />
    <div class="cards">
        {#each session.corporateActions as { companyId, canBorrow, buyBack } (companyId)}
            {@const name = getCompany(gameState, companyId).name}
            <CompanyActionCard
                {session}
                {companyId}
                value={money(companyMarketSpace(gameState.stockMarket, companyId).price)}
                facts={companyFinanceFacts(gameState, companyId, money)}
                actions={[
                    ...(canBorrow
                        ? [takeLoanAction(session, companyId, `Take a loan for ${name}`, busy)]
                        : []),
                    ...(buyBack
                        ? [
                              {
                                  label: 'Buy back a share',
                                  detail: `${money(buyBack.price)} · ${buyBack.available} in the market`,
                                  ariaLabel: `Buy back a ${name} share for ${money(buyBack.price)}`,
                                  disabled: busy,
                                  onclick: () => session.buyBackShare(companyId)
                              }
                          ]
                        : [])
                ]}
            />
        {/each}
    </div>
</section>

<style>
    section {
        container-type: inline-size;
        padding: 6px 0;
    }
    .cards {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
    }
</style>
