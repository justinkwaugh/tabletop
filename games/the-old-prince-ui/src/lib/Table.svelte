<script lang="ts">
    import { TheOldPrincePhaseChart } from './phaseChart.js'
    import { TheOldPrinceTrackColors } from '@tabletop/the-old-prince'
    import { TheOldPrinceCompanyNames } from './companyPresentation.js'
    import { isSplitCompany, TheOldPrinceEndingRules, TheOldPrinceCompanies, TheOldPrinceMap } from '@tabletop/the-old-prince'
    import { TheOldPrinceTrainColors } from './trainPresentation.js'
    import { TheOldPrinceOperatingRules } from '@tabletop/the-old-prince'
    import OpeningAuction from './OpeningAuction.svelte'
    import type { GameSession } from '@tabletop/frontend-components'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import { GameTable, OperatingActions, AuctionOffers, OfferAuctionBidding } from '@tabletop/18xx-ui'
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
</script>

<GameTable
    phaseChart={TheOldPrincePhaseChart}
    historyDescription={(action) => isSplitCompany(action) ? {
        text: `Split ${TheOldPrinceCompanyNames[action.branchId]?.short ?? action.branchId} from ${TheOldPrinceCompanyNames[action.parentId]?.short ?? action.parentId}`,
        value: `$${action.expectedFunding.toLocaleString('en-US')}`,
        detail: 'Branch capital', important: true
    } : undefined}
    {numberedShareLocation}
    mapFocusExcludedCompanyIds={['PEIR']}
    numberedShareNames={{ PEIR: Object.fromEntries(TheOldPrinceCompanies.map((company) => [company.number, company.name])) }}
    auctionLotDescription={(id) => lotInfo(id).description}
    companyNames={TheOldPrinceCompanyNames}
    marketPoolId="market"
    exchangePoolId="reserved"
    {session}
    portfolioCompanyIds={['UB']}
    valuationRules={TheOldPrinceEndingRules}
    trainColors={TheOldPrinceTrainColors}
    phaseColors={TheOldPrinceTrainColors}
    phaseTileColors={TheOldPrinceTrackColors}
    operatingRules={TheOldPrinceOperatingRules}
    privateOperationDescription={(id, companyId) =>
        id === 'HS' && companyId !== 'PEIR'
            ? 'Close to buy one depot train during the company’s turn, paying the normal train price.'
            : undefined}
    poolName={(pool) =>
        pool.id === 'reserved'
            ? 'Exchange'
            : pool.owner.kind === 'company'
              ? 'Treasury'
              : pool.name}
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
                <BranchSplitPreview {session} showUndo={false} />
            {:else}
                <OperatingActions onFocusRoute={focusRoute} {session} {createRouteWorker} trainColors={TheOldPrinceTrainColors} additionalStockActions={session.canPreviewSplit && session.myPlayer && session.splitModel.branches().length && session.splitModel.parents(session.myPlayer.id).some((parent) => !parent.reason) ? [{ label: 'Split', onSelect: () => session.chooseSplit() }] : []} />
            {/if}
        {/if}
    {/snippet}
</GameTable>
