<script lang="ts">
    import { companyMarketSpace, finiteCashOwnedBy, getCompany } from '@tabletop/18xx'
    import CompanyActionCard from './CompanyActionCard.svelte'
    import StockPanelHeading from './StockPanelHeading.svelte'
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
                facts={[
                    {
                        label: 'Treasury',
                        value: money(finiteCashOwnedBy(gameState, { kind: 'company', companyId }))
                    },
                    {
                        label: 'Loans',
                        value: `${session.loans.loans(companyId)}/${session.loans.capacity(companyId)}`
                    }
                ]}
                actions={[
                    ...(canBorrow
                        ? [
                              {
                                  label: 'Take a loan',
                                  detail: `+${money(100)}`,
                                  ariaLabel: `Take a loan for ${name}`,
                                  disabled: busy,
                                  onclick: () => session.loans.take(companyId)
                              }
                          ]
                        : []),
                    ...(buyBack
                        ? [
                              {
                                  label: 'Buy back a share',
                                  detail: money(buyBack.price),
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
