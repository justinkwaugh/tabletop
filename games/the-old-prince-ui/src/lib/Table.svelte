<script lang="ts">
    import { TheOldPrinceEndingRules, TheOldPrinceCompanies, TheOldPrinceMap } from '@tabletop/the-old-prince'
    import { TheOldPrinceTrainColors } from './trainPresentation.js'
    import { TheOldPrinceOperatingRules } from '@tabletop/the-old-prince'
    import OpeningAuction from './OpeningAuction.svelte'
    import type { GameSession } from '@tabletop/frontend-components'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import { GameTable, OperatingActions, AuctionOffers } from '@tabletop/18xx-ui'
    import { requireTheOldPrinceSession } from './session.svelte.js'
    import BranchSplitPreview from './BranchSplitPreview.svelte'
    let { gameSession }: { gameSession: GameSession<GameState, HydratedGameState> } = $props()
    function lotInfo(id: string) {
        const privateCompany = session.privateCompanies.find((company) => company.id === id)
        if (privateCompany) return { description: privateCompany.description, ...(id === 'VR' ? { locationId: 'N18' } : {}) }
        const share = session.financialState.certificates.find((certificate) => certificate.id === id)
        const company = share?.kind === 'share' ? TheOldPrinceCompanies.find((company) => company.number === share.number) : undefined
        const locationId = TheOldPrinceMap.definition.locations.find((location) => location.reservations?.some((reservation) => reservation.companyId === company?.companyId))?.id
        return { locationId, description: `A numbered PEIR share associated with ${company?.name}. Receives a share of PEIR dividends while outstanding. It may be exchanged when the associated railway is formed and is worth $80 at game end.` }
    }
    const session = $derived(requireTheOldPrinceSession(gameSession))
</script>

<GameTable
    {session}
    portfolioCompanyIds={['UB']}
    valuationRules={TheOldPrinceEndingRules}
    trainColors={TheOldPrinceTrainColors}
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
    {#snippet actions(focusLocation)}
        {#if session.offerAuction && !session.offerAuction.auction.completed}
            {#if !session.offerAuction.auction.bidding && !session.offerAuction.auction.stalled}
                <AuctionOffers {session} {lotInfo} onFocus={focusLocation} />
            {:else}
                <OpeningAuction {session} showUndo={false} />
            {/if}
        {:else}
            <OperatingActions {session} />
            <BranchSplitPreview {session} showUndo={false} />
        {/if}
    {/snippet}
</GameTable>
