<script lang="ts">
    import CompanyActionCard, { type CardAction } from '../stock/CompanyActionCard.svelte'
    import type { SizedCompanySessionView } from '../session/sizedCompanySession.svelte.js'
    import { companyAssetFacts, companyFinanceFacts, takeLoanAction } from './companyRoundFacts.js'
    import CompanyRoundPanel from './CompanyRoundPanel.svelte'
    import { counted } from '../presentation/count.js'
    let {
        session,
        companyId,
        titleActions = {}
    }: {
        session: SizedCompanySessionView
        companyId: string
        /** The title's own actions for the company deciding, offered beside the round's. */
        titleActions?: Readonly<Record<string, readonly CardAction[]>>
    } = $props()
    const money = $derived(session.presentation.money)
    const gameState = $derived(session.gameState)
    const rules = $derived(session.sizedCompanies)
    const valid = $derived(session.validActionTypes)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
    const conversions = $derived(session.conversions)
    const decision = $derived(conversions.decision)
    const trading = $derived(conversions.trading)
    const stations = $derived(conversions.stations)
    const name = (id: string) => session.companyName(id)

    const stationText = (count: number, cost: number) =>
        count ? `${counted(count, 'station')} for ${money(cost)}` : 'no stations'

    const actions = $derived.by((): CardAction[] => {
        if (decision)
            return [
                ...(decision.conversion
                    ? [
                          {
                              label: `Convert to ${decision.conversion.shareCount} shares`,
                              detail: `${counted(decision.conversion.newShares, 'treasury share')} · ${stationText(decision.conversion.stations.stations, decision.conversion.stations.cost)}`,
                              ariaLabel: `Convert to ${decision.conversion.shareCount} shares`,
                              disabled: busy,
                              onclick: () => conversions.convert()
                          }
                      ]
                    : []),
                {
                    label: 'Pass',
                    ariaLabel: 'Pass',
                    disabled: busy,
                    onclick: () => conversions.pass()
                }
            ]
        if (trading && valid.includes('PassConvertedShares'))
            return [
                ...trading.sales.map((sale) => ({
                    label: `Sell ${counted(sale.sales[0].shares, 'share')}`,
                    detail: money(sale.proceeds),
                    ariaLabel: `Sell ${counted(sale.sales[0].shares, 'share')} (${money(sale.proceeds)})`,
                    disabled: busy,
                    onclick: () => conversions.sellShares(sale.sales[0].shares)
                })),
                ...(trading.purchase
                    ? [
                          {
                              label: 'Buy a share',
                              detail: money(trading.purchase.price),
                              ariaLabel: `Buy a share (${money(trading.purchase.price)})`,
                              disabled: busy,
                              onclick: () => conversions.buyShare()
                          }
                      ]
                    : []),
                {
                    label: 'Pass',
                    ariaLabel: 'Pass',
                    disabled: busy,
                    onclick: () => conversions.passShares()
                }
            ]
        if (stations && valid.includes('FinishConversionLoans')) {
            const finish = !stations.stations
                ? 'Finish'
                : stations.affordable
                  ? `Buy ${counted(stations.stations, 'station')}`
                  : 'Finish and liquidate'
            return [
                ...(valid.includes('TakeLoan')
                    ? [takeLoanAction(session, companyId, 'Take a loan', busy)]
                    : []),
                {
                    label: finish,
                    detail: stations.stations ? money(stations.cost) : undefined,
                    ariaLabel: finish,
                    disabled: busy,
                    onclick: () => conversions.finishLoans()
                }
            ]
        }
        return []
    })
</script>

<CompanyRoundPanel
    {session}
    label="Merger round"
    {companyId}
    actions={[...actions, ...(titleActions[companyId] ?? [])]}
>
    {#if trading}
        <p>
            {counted(trading.remaining, 'treasury share')} at {money(trading.price)} · {session.getPlayerName(
                trading.traderIds[0]
            )} chooses{#if trading.traderIds.length > 1}, then {trading.traderIds
                    .slice(1)
                    .map((id) => session.getPlayerName(id))
                    .join(', ')}{/if}
        </p>
    {/if}
    {#if stations?.stations}
        <p>
            It must buy {stationText(stations.stations, stations.cost)}{stations.affordable
                ? ''
                : ', more than its treasury'}.
        </p>
    {/if}
    {#if decision?.targets.length}
        <h3>Or merge with</h3>
        <div class="cards">
            {#each decision.targets as target (target.companyId)}
                <CompanyActionCard
                    {session}
                    companyId={target.companyId}
                    value={money(rules.market.price(gameState, target.companyId))}
                    facts={[
                        ...companyFinanceFacts(rules, gameState, target.companyId, money),
                        ...companyAssetFacts(rules, gameState, target.companyId, (id) =>
                            session.companyName(id)
                        )
                    ]}
                    actions={[
                        {
                            label: 'Merge',
                            detail: `${target.preview.shareCount} shares at ${money(target.preview.price)} · ${counted(target.preview.treasuryShares, 'treasury share')} · ${counted(target.preview.stations, 'station')}`,
                            ariaLabel: `Merge with ${name(target.companyId)} (${money(target.preview.price)})`,
                            disabled: busy,
                            onclick: () => conversions.merge(target.companyId)
                        }
                    ]}
                />
            {/each}
        </div>
    {/if}
</CompanyRoundPanel>
