<script lang="ts">
    import { TheOldPrinceTrainColors } from './trainPresentation.js'
    import OpeningAuction from './OpeningAuction.svelte'
    import BranchSplitPreview from './BranchSplitPreview.svelte'
    import { requireTheOldPrinceSession } from './session.svelte.js'
    import type { GameSession } from '@tabletop/frontend-components'
    import { requireEighteenXXState } from '@tabletop/18xx'
    import type { GameState, HydratedGameState } from '@tabletop/common'
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
    let { gameSession }: { gameSession: GameSession<GameState, HydratedGameState> } = $props()
    const session = $derived(requireTheOldPrinceSession(gameSession))
    const state = $derived(requireEighteenXXState(gameSession.gameState))
</script>

<GameEnding {session} />

{#if session.offerAuction && !session.offerAuction.auction.completed}
    <OpeningAuction {session} />
{:else}
    <BranchSplitPreview {session} />
    <CompanyDecisions {session} trainColors={TheOldPrinceTrainColors} />
    <PrivateCompanies {session} />
    <TrainBuying {session} trainColors={TheOldPrinceTrainColors} />
    <FinanceMap {session} />
    <StockTrading {session} />
    <StockMarket animation={session.marketAnimation} appearances={session.mapView.stations} market={state.stockMarket} companies={state.companies} />

    {#if state.tranches.length}<section class="tranches" aria-label="Company tranches">
            {#each state.tranches as tranche (tranche.id)}<p>
                    {tranche.name}: {tranche.companyIds.join(' · ') || 'Empty'} ({tranche.companyIds
                        .length}/{tranche.capacity})
                </p>{/each}
        </section>{/if}
    <p class="peir-summary">
        PEIR: {state.companies.find((company) => company.id === 'PEIR')?.closed ? 'Closed.' : ''}
        {peirShares(state).length} outstanding shares. President: {gameSession.game.players.find(
            (player) => player.id === peirPresident(state)
        )?.name}. Largest shareholding wins; ties go to the lowest numbered share.
    </p>
{/if}

<FinanceInspector
    stations={state.stations}
    stationReservations={state.stationReservations}
    certificateWeight={session.certificateWeight}
    {state}
    players={gameSession.game.players}
    playerStates={state.players}
>
    {#snippet certificateDetail(certificate)}
        {#if certificate.kind === 'share' && certificate.companyId === 'PEIR'}
            <p class="share-income">
                1/{peirShares(state).length} of PEIR’s distributed earnings
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
