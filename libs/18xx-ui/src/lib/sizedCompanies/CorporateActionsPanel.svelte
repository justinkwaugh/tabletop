<script lang="ts">
    import CompanyActionCard, { type CardAction } from '../stock/CompanyActionCard.svelte'
    import CompanyActionPanel from '../stock/CompanyActionPanel.svelte'
    import type { SizedCompanySessionView } from '../session/sizedCompanySession.svelte.js'
    import { companyFinanceFacts, takeLoanAction } from './companyRoundFacts.js'
    let {
        session,
        titleActions = {}
    }: {
        session: SizedCompanySessionView
        /** The title's own actions for each company the president may act for. */
        titleActions?: Readonly<Record<string, readonly CardAction[]>>
    } = $props()
    const rules = $derived(session.sizedCompanies)
    const money = $derived(session.presentation.money)
    const gameState = $derived(session.gameState)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
    const acting = $derived(gameState.stockRound.turn.corporateAction)
    const companies = $derived([
        ...session.buyBacks.options,
        ...Object.keys(titleActions)
            .filter(
                (companyId) =>
                    titleActions[companyId].length &&
                    !session.buyBacks.options.some((option) => option.companyId === companyId)
            )
            .map((companyId) => ({ companyId, canBorrow: false, buyBack: undefined }))
    ])
</script>

<CompanyActionPanel
    label="Corporate actions"
    heading={acting ? `Acting for ${session.companyName(acting.companyId)}` : 'Act for a company'}
>
    {#each companies as { companyId, canBorrow, buyBack } (companyId)}
        {@const name = session.companyName(companyId)}
        <CompanyActionCard
            {session}
            {companyId}
            value={money(rules.market.price(gameState, companyId))}
            facts={companyFinanceFacts(rules, gameState, companyId, money)}
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
                              onclick: () => session.buyBacks.buyBack(companyId)
                          }
                      ]
                    : []),
                ...(titleActions[companyId] ?? [])
            ]}
        />
    {/each}
</CompanyActionPanel>
