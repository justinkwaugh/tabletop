<script lang="ts">
    import type { CertificatePool } from '@tabletop/18xx'
    import { TheOldPrincePhaseChart } from './phaseChart.js'
    import { availableTheOldPrinceTranche, TheOldPrinceTrackColors } from '@tabletop/the-old-prince'
    import { TheOldPrinceCompanyNames } from './companyPresentation.js'
    import { isSplitCompany, TheOldPrinceEndingRules, TheOldPrinceCompanies, TheOldPrinceMap } from '@tabletop/the-old-prince'
    import { TheOldPrinceTrainColors } from './trainPresentation.js'
    import { TheOldPrinceOperatingRules } from '@tabletop/the-old-prince'
    import OpeningAuction from './OpeningAuction.svelte'
    import type { GameSession } from '@tabletop/frontend-components'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import { CompanyToken, GameTable, OperatingActions, AuctionOffers, OfferAuctionBidding } from '@tabletop/18xx-ui'
    import { requireTheOldPrinceSession } from './session.svelte.js'
    import BranchSplitPreview from './BranchSplitPreview.svelte'
    function createRouteWorker() {
        return new Worker(new URL('./autorouter.worker.js', import.meta.url), { type: 'module' })
    }
    let { gameSession }: { gameSession: GameSession<GameState, HydratedGameState> } = $props()
    function lotInfo(id: string) {
        const privateCompany = session.privateCompanies.find((company) => company.id === id)
        if (privateCompany) return { description: privateCompany.description, ...(id === 'VR' ? { locationId: 'N18' } : {}) }
        const share = session.financialState.certificates.find((certificate) => certificate.id === id)
        const company = share?.kind === 'share' ? TheOldPrinceCompanies.find((company) => company.number === share.number) : undefined
        const locationId = company ? numberedShareLocation('PEIR', company.number) : undefined
        return { locationId, description: `A numbered PEIR share associated with ${company?.name}. Receives a share of PEIR dividends while outstanding. It may be exchanged when the associated railway is formed and is worth $80 at game end.` }
    }
    function numberedShareLocation(companyId: string, number: number) {
        if (companyId !== 'PEIR') return undefined
        const company = TheOldPrinceCompanies.find((company) => company.number === number)
        return TheOldPrinceMap.definition.locations.find((location) =>
            location.reservations?.some((reservation) => reservation.companyId === company?.companyId)
        )?.id
    }
    const session = $derived(requireTheOldPrinceSession(gameSession))
    const spreadsheetCompanyOrder = $derived.by(() => {
        const state = session.financialState
        const trancheCompanies = state.tranches.flatMap((tranche) => tranche.companyIds)
        return [
            ...state.companies.filter((company) => company.role === 'mainline').map((company) => company.id),
            ...state.companies.filter((company) => company.started && company.role !== 'mainline' && !trancheCompanies.includes(company.id)).map((company) => company.id),
            ...trancheCompanies
        ]
    })
    const availableTranche = $derived(availableTheOldPrinceTranche(session.financialState))
    const privateOperationDescription = (id: string, companyId: string) =>
        id === 'HS' && companyId !== 'PEIR'
            ? 'Close to buy one depot train during the company’s turn, paying the normal train price.'
            : undefined
    const poolName = (pool: CertificatePool) =>
        pool.id === 'reserved'
            ? 'Exchange'
            : pool.owner.kind === 'company'
              ? 'Treasury'
              : pool.name
</script>

<GameTable companyPricePresentation={{ showPar: false, label: 'Value', showInSpreadsheet: true }} {spreadsheetCompanyOrder} privatePurchaseLabel="Buy Hunslet"
    additionalStockActions={session.canPreviewSplit && session.myPlayer && session.splitModel.branches().length && session.splitModel.parents(session.myPlayer.id).some((parent) => !parent.reason) ? [{ label: 'Split', selected: session.hasSplitDraft, onSelect: () => session.chooseSplit() }] : []}
    phaseChart={TheOldPrincePhaseChart}
    historyDescription={(action, companyName) => isSplitCompany(action) ? {
        text: `Split ${companyName(action.branchId)} from ${companyName(action.parentId)}`,
        value: `$${action.expectedFunding.toLocaleString('en-US')}`,
        detail: 'Branch capital', important: true
    } : undefined}
    {numberedShareLocation}
    includedCompanyIds={['PEIR']}
    mapFocusExcludedCompanyIds={['PEIR']}
    numberedShareNames={{ PEIR: Object.fromEntries(TheOldPrinceCompanies.map((company) => [company.number, company.name])) }}
    auctionLotDescription={(id) => lotInfo(id).description}
    companyNames={TheOldPrinceCompanyNames}
    marketPoolId="market"
    exchangePoolId="reserved"
    {session}
    portfolioCompanyIds={['UB']}
    includedPortfolioCompanyIds={['UB']}
    valuationRules={TheOldPrinceEndingRules}
    trainColors={TheOldPrinceTrainColors}
    phaseColors={TheOldPrinceTrainColors}
    phaseTileColors={TheOldPrinceTrackColors}
    operatingRules={TheOldPrinceOperatingRules}
    {privateOperationDescription}
    {poolName}
>
    {#snippet actions(focusLocation, focusRoute)}
        {#if session.offerAuction && !session.offerAuction.auction.completed}
            {#if !session.offerAuction.auction.bidding && !session.offerAuction.auction.stalled}
                <AuctionOffers {session} {lotInfo} onFocus={focusLocation} />
            {:else if session.offerAuction.auction.bidding}
                <OfferAuctionBidding {session} {lotInfo} />
            {:else}
                <OpeningAuction {session} showUndo={false} />
            {/if}
        {:else}
            {#if session.hasSplitDraft}
                <BranchSplitPreview {session} showUndo={false} onFocusLocation={focusLocation} />
            {:else}
                <OperatingActions {poolName} {privateOperationDescription} onFocusRoute={focusRoute} {session} {createRouteWorker} trainColors={TheOldPrinceTrainColors} />
            {/if}
        {/if}
    {/snippet}
    {#snippet gameInformation()}
        <div class="tranches" aria-label="Company tranches">
            <span class="tranches-label">Tranches</span>
            {#each session.financialState.tranches.filter((tranche) => tranche.id !== 'initial') as tranche (tranche.id)}
                {@const closed = tranche.companyIds.length < tranche.capacity && tranche.id !== availableTranche?.id}
                <div class="tranche" class:closed aria-label={`${tranche.name}${closed ? ': closed' : ''}`} title={closed ? `${tranche.name}: closed` : tranche.name}>
                    {#each Array.from({ length: tranche.capacity }, (_, index) => tranche.companyIds[index]) as companyId}
                        <span class="tranche-slot" class:empty={!companyId}>
                            {#if companyId}<CompanyToken appearance={session.mapView.stations[companyId]} size={22} />
                            {:else if closed}<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5 7V5a3 3 0 0 1 6 0v2" /></svg>{/if}
                        </span>
                    {/each}
                </div>
            {/each}
        </div>
    {/snippet}
</GameTable>

<style>
    .tranches { display: flex; align-items: center; gap: 0; flex: none; margin-top: -8px; padding: 6px 8px; border-bottom: 1px solid var(--rail-border, #b8a995); }
    .tranches-label { color: var(--rail-muted, #887969); font-size: 10px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; line-height: 1; margin-right: 3px; }
    .tranche:last-child { padding-right: 0; }
    .tranche { display: flex; align-items: center; justify-content: center; flex-grow: 1; gap: 5px; padding: 0 8px; }
    .tranche + .tranche { border-left: 1px solid var(--rail-border, #b8a995); }
    .tranche-slot.empty { border-style: dashed; background: transparent; }
    .closed .tranche-slot.empty { color: var(--rail-text, #776657); opacity: 0.55; }
    .tranche-slot { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border: 1px solid var(--rail-border, #b8a995); border-radius: 50%; background: var(--rail-surface-raised, #dfd3c8); }
</style>
