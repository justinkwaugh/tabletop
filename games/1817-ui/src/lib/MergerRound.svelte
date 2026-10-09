<script lang="ts">
    import { EighteenSeventeenMarket } from '@tabletop/1817'
    import { getCompany } from '@tabletop/18xx'
    import { takeLoanAction } from './cardActions.js'
    import { CompanyActionCard, type CardAction } from '@tabletop/18xx-ui'
    import { plural } from './plural.js'
    import { companyAssetFacts, companyFinanceFacts } from './roundFacts.js'
    import RoundPanel from './RoundPanel.svelte'
    import type { EighteenSeventeenSession } from './session.svelte.js'
    let { session, companyId }: { session: EighteenSeventeenSession; companyId: string } = $props()
    const money = $derived(session.presentation.money)
    const gameState = $derived(session.gameState)
    const valid = $derived(session.validActionTypes)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
    const decision = $derived(session.mergerDecision)
    const trading = $derived(session.convertedShareTrading)
    const stations = $derived(session.conversionStations)
    const name = (id: string) => getCompany(gameState, id).name

    const stationText = (count: number, cost: number) =>
        count ? `${plural(count, 'station')} for ${money(cost)}` : 'no stations'

    const actions = $derived.by((): CardAction[] => {
        if (decision)
            return [
                ...(decision.conversion
                    ? [
                          {
                              label: `Convert to ${decision.conversion.shareCount} shares`,
                              detail: `${plural(decision.conversion.newShares, 'treasury share')} · ${stationText(decision.conversion.stations.stations, decision.conversion.stations.cost)}`,
                              ariaLabel: `Convert to ${decision.conversion.shareCount} shares`,
                              disabled: busy,
                              onclick: () => session.convertCompany()
                          }
                      ]
                    : []),
                {
                    label: 'Pass',
                    ariaLabel: 'Pass',
                    disabled: busy,
                    onclick: () => session.passMerger()
                }
            ]
        if (trading && valid.includes('PassConvertedShares'))
            return [
                ...trading.sales.map((sale) => ({
                    label: `Sell ${plural(sale.sales[0].shares, 'share')}`,
                    detail: money(sale.proceeds),
                    ariaLabel: `Sell ${plural(sale.sales[0].shares, 'share')} (${money(sale.proceeds)})`,
                    disabled: busy,
                    onclick: () => session.sellConvertedShares(sale.sales[0].shares)
                })),
                ...(trading.purchase
                    ? [
                          {
                              label: 'Buy a share',
                              detail: money(trading.purchase.price),
                              ariaLabel: `Buy a share (${money(trading.purchase.price)})`,
                              disabled: busy,
                              onclick: () => session.buyConvertedShare()
                          }
                      ]
                    : []),
                {
                    label: 'Pass',
                    ariaLabel: 'Pass',
                    disabled: busy,
                    onclick: () => session.passConvertedShares()
                }
            ]
        if (stations && valid.includes('FinishConversionLoans')) {
            const finish = !stations.stations
                ? 'Finish'
                : stations.affordable
                  ? `Buy ${plural(stations.stations, 'station')}`
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
                    onclick: () => session.finishConversionLoans()
                }
            ]
        }
        return []
    })
</script>

<RoundPanel {session} label="Merger round" {companyId} {actions}>
    {#if trading}
        <p>
            {plural(trading.remaining, 'treasury share')} at {money(trading.price)} · {session.getPlayerName(
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
                    value={money(
                        EighteenSeventeenMarket.companySpace(
                            gameState.stockMarket,
                            target.companyId
                        ).price
                    )}
                    facts={[
                        ...companyFinanceFacts(gameState, target.companyId, money),
                        ...companyAssetFacts(gameState, target.companyId)
                    ]}
                    actions={[
                        {
                            label: 'Merge',
                            detail: `${target.preview.shareCount} shares at ${money(target.preview.price)} · ${plural(target.preview.treasuryShares, 'treasury share')} · ${plural(target.preview.stations, 'station')}`,
                            ariaLabel: `Merge with ${name(target.companyId)} (${money(target.preview.price)})`,
                            disabled: busy,
                            onclick: () => session.mergeCompanies(target.companyId)
                        }
                    ]}
                />
            {/each}
        </div>
    {/if}
</RoundPanel>
