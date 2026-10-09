<script lang="ts">
    import { getCompany } from '@tabletop/18xx'
    import {
        AuctionBidControl,
        CompanyActionCard,
        CompanyToken,
        type CardAction
    } from '@tabletop/18xx-ui'
    import { EighteenSeventeenLoanRules } from '@tabletop/1817'
    import { takeLoanAction } from './cardActions.js'
    import { companyFinanceFacts } from './roundFacts.js'
    import RoundPanel from './RoundPanel.svelte'
    import type { EighteenSeventeenSession } from './session.svelte.js'
    let { session, companyId }: { session: EighteenSeventeenSession; companyId: string } = $props()
    const money = $derived(session.presentation.money)
    const gameState = $derived(session.gameState)
    const valid = $derived(session.validActionTypes)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
    const offer = $derived(session.acquisitionOffer)
    const sale = $derived(session.companySale)
    const choice = $derived(session.acquirerChoice)
    const acquisition = $derived(session.buyerLoans)
    const name = (id: string) => session.companyName(id)
    const zones = {
        offered: 'Offered for sale',
        acquisition: 'In the acquisition zone',
        liquidation: 'Being liquidated'
    }
    // Derived so that another player's bid lifts it to the new minimum.
    let amount = $derived(sale?.minimum ?? 0)
    const payers = $derived(sale ? sale.payers(amount) : [])

    const actions = $derived.by((): CardAction[] => {
        if (offer)
            return [
                {
                    label: 'Offer for sale',
                    detail: `from ${money(offer.openingBid)}`,
                    ariaLabel: 'Offer for sale',
                    disabled: busy,
                    onclick: () => session.offerCompany()
                },
                {
                    label: 'Keep',
                    ariaLabel: 'Keep',
                    disabled: busy,
                    onclick: () => session.declineOffer()
                }
            ]
        if (acquisition && valid.includes('FinishAcquisitionLoans'))
            return [
                ...(valid.includes('TakeLoan')
                    ? [takeLoanAction(session, acquisition.buyerId, 'Take a loan', busy)]
                    : []),
                ...(valid.includes('RepayAcquiredLoan')
                    ? [
                          {
                              label: 'Repay a loan it took on',
                              detail: money(EighteenSeventeenLoanRules.value),
                              ariaLabel: `Repay a loan it took on (${money(EighteenSeventeenLoanRules.value)})`,
                              disabled: busy,
                              onclick: () => session.repayAcquiredLoan()
                          }
                      ]
                    : []),
                {
                    label: 'Finish',
                    ariaLabel: 'Finish',
                    disabled: busy,
                    onclick: () => session.finishAcquisitionLoans()
                }
            ]
        return []
    })
</script>

<RoundPanel
    {session}
    label="Acquisition round"
    companyId={acquisition?.buyerId ?? companyId}
    {actions}
>
    {#if acquisition}
        <p>
            Bought {name(companyId)} for {money(acquisition.price)} · took on {acquisition.inheritedLoans}
            of its loans, repaid {acquisition.repaidLoans}
        </p>
    {/if}
    {#if sale}
        <p>
            {zones[sale.kind]} ·
            {#if sale.highBid}high bid {money(sale.highBid.amount)} by {session.getPlayerName(
                    sale.highBid.playerId
                )}{:else}no bids yet{/if}
        </p>
        {#if valid.includes('BidToAcquire') && sale.maximum !== undefined}
            <div class="bid">
                <AuctionBidControl
                    {money}
                    {amount}
                    increment={10}
                    canBid={!busy && amount >= sale.minimum && amount <= sale.maximum}
                    canDecrease={amount - 10 >= sale.minimum}
                    canIncrease={amount + 10 <= sale.maximum}
                    canPass={!busy}
                    onChange={(value) => (amount = value)}
                    onBid={() => session.bidToAcquire(amount)}
                    onPass={() => session.passOnCompany()}
                />
                <p class="payers">
                    {payers.length
                        ? `Paid by ${payers.map(name).join(' or ')}`
                        : 'None of your companies could pay this'} · up to {money(sale.maximum)}
                </p>
            </div>
        {/if}
    {/if}
    {#if choice}
        <h3>{session.getPlayerName(choice.playerId)} buys it with</h3>
        <div class="cards">
            {#each choice.buyerIds as buyerId (buyerId)}
                <CompanyActionCard
                    {session}
                    companyId={buyerId}
                    facts={companyFinanceFacts(gameState, buyerId, money)}
                    actions={[
                        {
                            label: `Buy with ${name(buyerId)}`,
                            detail: money(choice.amount),
                            ariaLabel: `Buy with ${name(buyerId)}`,
                            disabled: busy,
                            onclick: () => session.acquireCompany(buyerId)
                        }
                    ]}
                />
            {/each}
        </div>
    {/if}
    {#if session.acquisitionQueue.length}
        <p class="queue">
            Still to offer
            {#each session.acquisitionQueue as id (id)}<span title={name(id)}
                    ><CompanyToken appearance={session.mapView.stations[id]} size={18} /></span
                >{/each}
        </p>
    {/if}
</RoundPanel>

<style>
    .bid {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        margin-top: 6px;
    }
    .payers,
    .queue {
        color: var(--rail-muted, #887969);
    }
    .queue {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        margin-top: 10px;
    }
</style>
