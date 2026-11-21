<script lang="ts">
    import AuctionBidControl from '../auctions/AuctionBidControl.svelte'
    import CompanyActionCard, { type CardAction } from '../stock/CompanyActionCard.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import type { SizedCompanySessionView } from '../session/sizedCompanySession.svelte.js'
    import { companyFinanceFacts, takeLoanAction } from './companyRoundFacts.js'
    import CompanyRoundPanel from './CompanyRoundPanel.svelte'
    let {
        session,
        companyId,
        titleActions = {}
    }: {
        session: SizedCompanySessionView
        companyId: string
        /** The title's own actions for the company deciding, offered beside the round's. */
        titleActions?: Readonly<Record<string, readonly CardAction[]>>
    } = $props()
    const money = $derived(session.presentation.money)
    const gameState = $derived(session.gameState)
    const rules = $derived(session.sizedCompanies)
    const valid = $derived(session.validActionTypes)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
    const acquisitions = $derived(session.acquisitions)
    const offer = $derived(acquisitions.offer)
    const sale = $derived(acquisitions.sale)
    const choice = $derived(acquisitions.acquirerChoice)
    const acquisition = $derived(acquisitions.buyerLoans)
    const increment = $derived(acquisitions.increment)
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
                    onclick: () => acquisitions.offerCompany()
                },
                {
                    label: 'Keep',
                    ariaLabel: 'Keep',
                    disabled: busy,
                    onclick: () => acquisitions.declineOffer()
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
                              detail: money(acquisitions.loanValue),
                              ariaLabel: `Repay a loan it took on (${money(acquisitions.loanValue)})`,
                              disabled: busy,
                              onclick: () => acquisitions.repayLoan()
                          }
                      ]
                    : []),
                {
                    label: 'Finish',
                    ariaLabel: 'Finish',
                    disabled: busy,
                    onclick: () => acquisitions.finishLoans()
                }
            ]
        return []
    })
</script>

<CompanyRoundPanel
    {session}
    label="Acquisition round"
    companyId={acquisition?.buyerId ?? companyId}
    actions={[...actions, ...(titleActions[acquisition?.buyerId ?? companyId] ?? [])]}
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
                    {increment}
                    canBid={!busy && sale.allows(amount)}
                    canDecrease={amount - increment >= sale.minimum}
                    canIncrease={amount + increment <= sale.maximum}
                    canPass={!busy}
                    onChange={(value) => (amount = value)}
                    onBid={() => acquisitions.bid(amount)}
                    onPass={() => acquisitions.passOnCompany()}
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
                    facts={companyFinanceFacts(rules, gameState, buyerId, money)}
                    actions={[
                        {
                            label: `Buy with ${name(buyerId)}`,
                            detail: money(choice.amount),
                            ariaLabel: `Buy with ${name(buyerId)}`,
                            disabled: busy,
                            onclick: () => acquisitions.acquire(buyerId)
                        }
                    ]}
                />
            {/each}
        </div>
    {/if}
    {#if acquisitions.queue.length}
        <p class="queue">
            Still to offer
            {#each acquisitions.queue as id (id)}<span title={name(id)}
                    ><CompanyToken appearance={session.mapView.stations[id]} size={18} /></span
                >{/each}
        </p>
    {/if}
</CompanyRoundPanel>

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
