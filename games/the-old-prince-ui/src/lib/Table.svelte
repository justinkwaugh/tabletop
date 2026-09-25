<script lang="ts">
    import {
        isSplitCompany,
        TheOldPrinceCompanies,
        TheOldPrinceMap
    } from '@tabletop/the-old-prince'
    import OpeningAuction from './OpeningAuction.svelte'
    import type { GameSession } from '@tabletop/frontend-components'
    import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'
    import {
        GameTable,
        MarketTokenSize,
        OperatingActions,
        AuctionOffers,
        OfferAuctionBidding
    } from '@tabletop/18xx-ui'
    import { requireTheOldPrinceSession } from './session.svelte.js'
    import BranchSplitPreview from './BranchSplitPreview.svelte'
    import Tranches from './Tranches.svelte'
    function createRouteWorker() {
        return new Worker(new URL('./autorouter.worker.js', import.meta.url), { type: 'module' })
    }
    let { gameSession }: { gameSession: GameSession<EighteenXXState, HydratedEighteenXXState> } =
        $props()
    function lotInfo(id: string) {
        const privateCompany = session.privates.companies.find((company) => company.id === id)
        if (privateCompany)
            return {
                description: privateCompany.description,
                ...(id === 'VR' ? { locationId: 'N18' } : {})
            }
        const share = session.gameState.certificates.find((certificate) => certificate.id === id)
        const company =
            share?.kind === 'share'
                ? TheOldPrinceCompanies.find((company) => company.number === share.number)
                : undefined
        const locationId = company ? numberedShareLocation('PEIR', company.number) : undefined
        return {
            locationId,
            description: `A numbered PEIR share associated with ${company?.name}. Receives a share of PEIR dividends while outstanding. It may be exchanged when the associated railway is formed and is worth $80 at game end.`
        }
    }
    function numberedShareLocation(companyId: string, number: number) {
        if (companyId !== 'PEIR') return undefined
        const company = TheOldPrinceCompanies.find((company) => company.number === number)
        return TheOldPrinceMap.definition.locations.find((location) =>
            location.reservations?.some(
                (reservation) => reservation.companyId === company?.companyId
            )
        )?.id
    }
    const session = $derived(requireTheOldPrinceSession(gameSession))
    const spreadsheetCompanyOrder = $derived.by(() => {
        const gameState = session.gameState
        const trancheCompanies = gameState.tranches.flatMap((tranche) => tranche.companyIds)
        return [
            ...gameState.companies
                .filter((company) => company.role === 'mainline')
                .map((company) => company.id),
            ...gameState.companies
                .filter(
                    (company) =>
                        company.started &&
                        company.role !== 'mainline' &&
                        !trancheCompanies.includes(company.id)
                )
                .map((company) => company.id),
            ...trancheCompanies
        ]
    })
    const privateOperationDescription = (id: string, companyId: string) =>
        id === 'HS' && companyId !== 'PEIR'
            ? 'Close to buy one depot train during the company’s turn, paying the normal train price.'
            : undefined
</script>

<GameTable
    {spreadsheetCompanyOrder}
    additionalStockActions={session.additionalStockMenuCount
        ? [
              {
                  label: 'Split',
                  selected: session.splitInProgress,
                  onSelect: () => session.chooseSplit()
              }
          ]
        : []}
    historyDescription={(action, companyName) =>
        isSplitCompany(action)
            ? {
                  text: `Split ${companyName(action.branchId)} from ${companyName(action.parentId)}`,
                  value: session.presentation.money(action.expectedFunding),
                  detail: 'Branch capital',
                  important: true
              }
            : undefined}
    {numberedShareLocation}
    auctionLotDescription={(id) => lotInfo(id).description}
    {session}
    {privateOperationDescription}
>
    {#snippet actions(focusLocation, focusRoute)}
        {#if session.offers.model && !session.offers.model.auction.completed}
            {#if !session.offers.model.auction.bidding && !session.offers.model.auction.stalled}
                <AuctionOffers {session} {lotInfo} onFocus={focusLocation} />
            {:else if session.offers.model.auction.bidding}
                <OfferAuctionBidding {session} {lotInfo} />
            {:else}
                <OpeningAuction {session} showUndo={false} />
            {/if}
        {:else if session.splitInProgress}
            <BranchSplitPreview {session} showUndo={false} onFocusLocation={focusLocation} />
        {:else}
            <OperatingActions
                {privateOperationDescription}
                onFocusRoute={focusRoute}
                {session}
                {createRouteWorker}
            />
        {/if}
    {/snippet}
    {#snippet gameInformation()}
        <div class="tranches" aria-label="Company tranches">
            <span class="tranches-label">Tranches</span>
            <Tranches {session} spread />
        </div>
    {/snippet}
    {#snippet boardInformation()}
        <div class="board-tranches" aria-label="Company tranches">
            <span class="board-tranches-label">Tranches</span>
            <div class="board-tranche-groups">
                <Tranches {session} slotSize={MarketTokenSize} named />
            </div>
        </div>
    {/snippet}
</GameTable>

<style>
    .tranches {
        display: flex;
        align-items: center;
        gap: 0;
        flex: none;
        margin-top: -8px;
        padding: 6px 8px;
        border-bottom: 1px solid var(--rail-border, #b8a995);
    }
    .tranches-label {
        color: var(--rail-muted, #887969);
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        line-height: 1;
        margin-right: 3px;
    }
    .board-tranches {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
    }
    .board-tranches-label {
        color: var(--rail-text, #e3e9ef);
        font-size: 15px;
        font-weight: 650;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }
    .board-tranche-groups {
        display: flex;
        align-items: flex-start;
    }
</style>
