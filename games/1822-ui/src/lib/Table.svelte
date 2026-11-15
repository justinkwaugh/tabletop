<script lang="ts">
    import { assert } from '@tabletop/common'
    import type { GameSession } from '@tabletop/frontend-components'
    import { PrivateRules1822, type HydratedState1822, type State1822 } from '@tabletop/1822'
    import { privateOwningCompany } from '@tabletop/18xx'
    import { BidBoxes, GameTable, OperatingActions } from '@tabletop/18xx-ui'
    import AcquisitionOffer from './AcquisitionOffer.svelte'
    import LotCard from './LotCard.svelte'
    import StockTurn from './StockTurn.svelte'
    import TitleMode from './TitleMode.svelte'
    import { describe1822Action } from './history.js'
    import { bidBoxGroups, lotName } from './lots.js'
    import { createRouteWorker } from './routeWorker.js'
    import { Session1822 } from './session.svelte.js'
    let { gameSession }: { gameSession: GameSession<State1822, HydratedState1822> } = $props()
    const session = $derived.by(() => {
        assert(gameSession instanceof Session1822, '1822 requires its title session')
        return gameSession
    })
    // A company's private shows what it can still do for it.
    const privateOperationDescription = (privateCompanyId: string) =>
        privateOwningCompany(session.gameState, privateCompanyId)
            ? PrivateRules1822.description(session.gameState, privateCompanyId)
            : undefined
    const groups = $derived(bidBoxGroups(session.gameState))
    const historyDescription = $derived(describe1822Action(session))
</script>

{#snippet lot(lotId: string)}
    <LotCard {session} {lotId} />
{/snippet}

{#snippet biddingBoard()}
    <BidBoxes {session} {groups} {lot} {lotName} board />
{/snippet}

<GameTable
    {session}
    {privateOperationDescription}
    {createRouteWorker}
    {historyDescription}
    additionalStockActions={session.stockPanels.menuOptions}
    boardPanel={{ label: 'Bidding boxes', content: biddingBoard }}
>
    {#snippet actions(_focusLocation, focusRoute)}
        {#if session.cashDeclarer}
            <StockTurn {session} />
        {:else if session.acquisitionOffer || session.privateOffer}
            <AcquisitionOffer {session} />
        {:else}
            {#if session.loanRepayment}<StockTurn {session} />{/if}
            {#if session.stockPanels.open === 'bids'}
                <BidBoxes {session} {groups} {lot} {lotName} />
            {:else}
                <OperatingActions {privateOperationDescription} onFocusRoute={focusRoute} {session}>
                    {#snippet titleMode(id)}
                        <TitleMode {session} {id} />
                    {/snippet}
                </OperatingActions>
            {/if}
        {/if}
    {/snippet}
</GameTable>
