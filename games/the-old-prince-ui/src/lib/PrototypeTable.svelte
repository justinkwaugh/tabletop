<script lang="ts">
    import { TheOldPrinceTrainColors } from './trainPresentation.js'
    import OpeningAuction from './OpeningAuction.svelte'
    import BranchSplitPreview from './BranchSplitPreview.svelte'
    import { requireTheOldPrinceSession } from './session.svelte.js'
    import type { GameSession } from '@tabletop/frontend-components'
    import { requireEighteenXXState } from '@tabletop/18xx'
    import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'
    import {
        GameEnding,
        FinanceInspector,
        FinanceMap,
        TrainBuying,
        PrivateCompanies,
        CompanyDecisions,
        StockTrading,
        StockMarket
    } from '@tabletop/18xx-ui'
    import { peirShares, peirPresident } from '@tabletop/the-old-prince'
    let { gameSession }: { gameSession: GameSession<EighteenXXState, HydratedEighteenXXState> } =
        $props()
    const session = $derived(requireTheOldPrinceSession(gameSession))
    const gameState = $derived(requireEighteenXXState(gameSession.gameState))
</script>

<GameEnding {session} />

{#if session.offers.model && !session.offers.model.auction.completed}
    <OpeningAuction {session} />
{:else}
    <BranchSplitPreview {session} />
    <CompanyDecisions {session} trainColors={TheOldPrinceTrainColors} />
    <PrivateCompanies {session} />
    <TrainBuying {session} trainColors={TheOldPrinceTrainColors} />
    <FinanceMap {session} />
    <StockTrading {session} />
    <StockMarket
        animation={session.marketAnimation}
        appearances={session.mapView.stations}
        market={gameState.stockMarket}
        companies={gameState.companies}
    />

    {#if gameState.tranches.length}<section class="tranches" aria-label="Company tranches">
            {#each gameState.tranches as tranche (tranche.id)}<p>
                    {tranche.name}: {tranche.companyIds.join(' · ') || 'Empty'} ({tranche.companyIds
                        .length}/{tranche.capacity})
                </p>{/each}
        </section>{/if}
    <p class="peir-summary">
        PEIR: {gameState.companies.find((company) => company.id === 'PEIR')?.closed
            ? 'Closed.'
            : ''}
        {peirShares(gameState).length} outstanding shares. President: {gameSession.game.players.find(
            (player) => player.id === peirPresident(gameState)
        )?.name}. Largest shareholding wins; ties go to the lowest numbered share.
    </p>
{/if}

<FinanceInspector
    stations={gameState.stations}
    stationReservations={gameState.stationReservations}
    certificateWeight={session.certificateWeight}
    {gameState}
    players={gameSession.game.players}
    playerStates={gameState.players}
>
    {#snippet certificateDetail(certificate)}
        {#if certificate.kind === 'share' && certificate.companyId === 'PEIR'}
            <p class="share-income">
                1/{peirShares(gameState).length} of PEIR’s distributed earnings
            </p>
        {/if}
    {/snippet}
</FinanceInspector>

<style>
    .tranches {
        margin-bottom: 16px;
        font-size: 13px;
    }
    .peir-summary {
        margin: 0 0 20px;
        color: #3e5c50;
        font:
            13px/1.5 ui-sans-serif,
            system-ui,
            sans-serif;
    }
    .share-income {
        margin: 6px 0 0;
        color: var(--rail-text, #46674f);
        font-size: 12px;
    }
</style>
