<script lang="ts">
    import { companyMarketSpace, getCompany } from '@tabletop/18xx'
    import CompanyActionCard, { type CardAction } from './CompanyActionCard.svelte'
    import { plural } from './plural.js'
    import { companyRoundFacts } from './roundFacts.js'
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
        if (stations && valid.includes('FinishConversionLoans'))
            return [
                ...(valid.includes('TakeLoan')
                    ? [
                          {
                              label: 'Take a loan',
                              detail: `+${money(100)}`,
                              ariaLabel: 'Take a loan',
                              disabled: busy,
                              onclick: () => session.loans.take(companyId)
                          }
                      ]
                    : []),
                {
                    label: !stations.stations
                        ? 'Finish'
                        : stations.affordable
                          ? `Buy ${plural(stations.stations, 'station')}`
                          : 'Finish and liquidate',
                    detail: stations.stations ? money(stations.cost) : undefined,
                    ariaLabel: !stations.stations
                        ? 'Finish'
                        : stations.affordable
                          ? `Buy ${plural(stations.stations, 'station')}`
                          : 'Finish and liquidate',
                    disabled: busy,
                    onclick: () => session.finishConversionLoans()
                }
            ]
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
                    value={money(companyMarketSpace(gameState.stockMarket, target.companyId).price)}
                    facts={companyRoundFacts(gameState, target.companyId, money).filter(
                        (fact) => fact.label !== 'Size'
                    )}
                    actions={[
                        {
                            label: 'Merge',
                            detail: `${decision.mergedSize} shares at ${money(target.price)}`,
                            ariaLabel: `Merge with ${name(target.companyId)} (${money(target.price)})`,
                            disabled: busy,
                            onclick: () => session.mergeCompanies(target.companyId)
                        }
                    ]}
                />
            {/each}
        </div>
    {/if}
</RoundPanel>
