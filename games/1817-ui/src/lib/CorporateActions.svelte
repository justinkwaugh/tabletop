<script lang="ts">
    import { EighteenSeventeenMarket } from '@tabletop/1817'
    import { getCompany } from '@tabletop/18xx'
    import { takeLoanAction } from './cardActions.js'
    import { CompanyActionCard, CompanyActionPanel } from '@tabletop/18xx-ui'
    import { companyFinanceFacts } from './roundFacts.js'
    import type { EighteenSeventeenSession } from './session.svelte.js'
    let { session }: { session: EighteenSeventeenSession } = $props()
    const money = $derived(session.presentation.money)
    const gameState = $derived(session.gameState)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
    const acting = $derived(gameState.stockRound.turn.corporateAction)
</script>

<CompanyActionPanel
    label="Corporate actions"
    heading={acting ? `Acting for ${session.companyName(acting.companyId)}` : 'Act for a company'}
>
    {#each session.corporateActions as { companyId, canBorrow, buyBack } (companyId)}
        {@const name = session.companyName(companyId)}
        <CompanyActionCard
            {session}
            {companyId}
            value={money(
                EighteenSeventeenMarket.companySpace(gameState.stockMarket, companyId).price
            )}
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
</CompanyActionPanel>
