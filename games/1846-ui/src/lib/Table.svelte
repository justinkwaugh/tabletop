<script lang="ts">
    import {
        companyMarketSpace,
        sharesOwned,
        finiteCashOwnedBy,
        getCompany,
        trainsOwnedBy,
        privateOwningCompany
    } from '@tabletop/18xx'
    import { GameEnding, RouteBuilding } from '@tabletop/18xx-ui'
    import { PortSymbols, steamboatCompanies, inReceivership, TrainRules1846 } from '@tabletop/1846'
    import Board from './Board.svelte'
    import ConstructionPowers from './ConstructionPowers.svelte'
    import RevenuePowers from './RevenuePowers.svelte'
    import OpeningCompanies from './OpeningCompanies.svelte'
    import EmergencyTrains from './EmergencyTrains.svelte'
    import { assert } from '@tabletop/common'
    import {
        draftCompany,
        isBlank,
        priceFor,
        type EighteenFortySixProjectedState,
        type HydratedEighteenFortySixState
    } from '@tabletop/1846'
    import type { GameSession } from '@tabletop/frontend-components'
    import { CompanyDescriptions } from './companyDescriptions.js'
    import { EighteenFortySixSession } from './session.svelte.js'
    let {
        gameSession
    }: { gameSession: GameSession<EighteenFortySixProjectedState, HydratedEighteenFortySixState> } =
        $props()
    const session = $derived.by(() => {
        assert(gameSession instanceof EighteenFortySixSession, '1846 requires its title session')
        return gameSession
    })
    const state = $derived(session.gameState)
    const hiddenDraft = $derived(state.draft.kind === 'hidden' ? state.draft : undefined)
    const mine = $derived(
        hiddenDraft?.participants.find((player) => player.playerId === session.myPlayer?.id)
    )
    const name = (id: string) => session.game.players.find((player) => player.id === id)?.name ?? id
    const label = (id: string) => (isBlank(id) ? 'Blank — take no company' : draftCompany(id).name)
</script>

<main>
    <header>
        <p class="eyebrow">1846 · The Race to the Midwest</p>
        <h1>
            {state.result
                ? 'Game over'
                : state.machineState === 'BuyingOpeningCompanies'
                  ? 'Private company purchases'
                  : state.machineState === 'StockRound'
                    ? `Stock round ${state.stockRound.number}`
                    : state.operatingSet !== undefined
                      ? `Operating round ${state.operatingSet.number}.${state.operatingSet.roundNumber}`
                      : 'Private company distribution'}
        </h1>
    </header>
    <nav aria-label="Game history">
        <button
            disabled={session.busy || !session.history.hasPreviousAction}
            onclick={() => session.history.goToPreviousAction()}>Previous action</button
        >
        <button
            disabled={session.busy || !session.history.hasNextAction}
            onclick={() => session.history.goToNextAction()}>Next action</button
        >
        <button
            disabled={session.busy ||
                session.isViewingHistory ||
                (!session.undoableAction &&
                    !session.privateDraft &&
                    !session.selectedAcquisition &&
                    !session.selectedLocation &&
                    !(session.canRun && session.routes.hasManual()))}
            onclick={() => session.undo()}>Undo</button
        >
        {#if session.isViewingHistory}<span>History · read only</span>{/if}
    </nav>
    {#if session.displayedPhase?.metadata}
        {@const phase = session.displayedPhase.metadata}
        <section aria-label="Phase change result">
            <h2>Phase {phase.event.toPhaseId}</h2>
            {#if phase.event.pendingRustTrainIds.length}<p>
                    Trains {phase.event.pendingRustTrainIds.join(', ')} are phased out: they do not count
                    toward the limit and are removed after their owner's next route step.
                </p>{/if}
            {#if phase.event.rustedTrainIds.length}<p>
                    Trains removed immediately: {phase.event.rustedTrainIds.join(', ')}.
                </p>{/if}
            {#if phase.closedRailroads.length}<p>
                    Independents closed: {phase.closedRailroads
                        .map((closure) => closure.companyId)
                        .join(', ')}.
                </p>{/if}
            {#if phase.event.privateEffects.length}<p>
                    Privates closed: {phase.event.privateEffects
                        .map((effect) => effect.privateCompanyId)
                        .join(', ')}.
                </p>{/if}
            {#if phase.removedReservations.length}<p>
                    Released station reservations: {phase.removedReservations
                        .map(
                            (reservation) => `${reservation.companyId} at ${reservation.locationId}`
                        )
                        .join(', ')}.
                </p>{/if}
            {#if phase.removedSteamboat}<p>
                    The player-owned Steamboat assignment was removed.
                </p>{/if}
            {#if phase.removedRevenueMarkers.length}<p>
                    Revenue markers removed: {phase.removedRevenueMarkers
                        .map(
                            (marker) =>
                                `${marker.companyId}'s ${marker.privateCompanyId} at ${marker.locationId}`
                        )
                        .join(', ')}.
                </p>{/if}
        </section>
    {/if}
    {#if session.displayedDiscard}<p aria-label="Train discard result">
            {session.displayedDiscard.companyId} returned {session.displayedDiscard.trainId} to the bank
            for $0.
        </p>{/if}
    {#if session.displayedRust?.metadata}<p aria-label="Train retirement result">
            {session.displayedRust.companyId}'s phased-out trains were removed: {session.displayedRust.metadata.trainIds.join(
                ', '
            )}.
        </p>{/if}
    {#if session.displayedEmergencyPurchase}
        {@const purchase = session.displayedEmergencyPurchase}
        <p aria-label="Emergency purchase result">
            {purchase.companyId} bought {purchase.definitionId}
            for ${purchase.price}.
            {#if purchase.issuedShares}
                Issued {purchase.issuedShares}
                {purchase.issuedShares === 1 ? 'share' : 'shares'} for ${purchase.proceeds}.
            {/if}
            President contributed ${purchase.contribution}.
        </p>
    {/if}
    {#if session.displayedFundingStart?.metadata}
        {@const start = session.displayedFundingStart}
        <p aria-label="Emergency funding result">
            {start.companyId} began emergency funding, issuing {start.metadata?.certificateIds
                .length} treasury {start.metadata?.certificateIds.length === 1
                ? 'share'
                : 'shares'}.
        </p>
    {/if}
    {#if session.displayedEmergencySale?.metadata}
        {@const sale = session.displayedEmergencySale}
        <p aria-label="Emergency share sale result">
            {name(sale.playerId)} sold {sale.shares * 10}% of {sale.companyId} for ${sale.metadata
                ?.proceeds} to fund a train purchase.
        </p>
    {/if}
    {#if session.displayedReceiverTrain?.metadata}
        {@const purchase = session.displayedReceiverTrain.metadata}
        <p aria-label="Receiver train purchase result">
            {purchase.companyId} automatically bought
            {purchase.definitionId} for ${purchase.price}.
        </p>
    {/if}
    {#if session.displayedReceiverShare?.metadata}
        {@const purchase = session.displayedReceiverShare}
        <p aria-label="Presidency recovery result">
            {name(purchase.playerId)} paid ${purchase.expectedPrice}
            for a virtual 10% share and became president of {purchase.companyId}.
        </p>
    {/if}
    <GameEnding {session} />
    {#if session.displayedBankruptcy?.metadata}
        {@const bankruptcy = session.displayedBankruptcy}
        <p aria-label="Bankruptcy result">
            {name(bankruptcy.playerId)} declared bankruptcy.
            {#if bankruptcy.metadata?.receiverCompanyIds.length}
                In receivership: {bankruptcy.metadata.receiverCompanyIds.join(', ')}.
            {/if}
        </p>
    {/if}
    {#if state.machineState === 'RunningReceiver'}
        <p>
            Receivership: any surviving player may enter the best routes they can find. Revenue is
            withheld and train purchases are automatic.
        </p>
    {/if}
    <RevenuePowers {session} />
    <ConstructionPowers {session} />
    {#if state.purchaseOffer}
        {@const offer = state.purchaseOffer}
        <section aria-label="Company purchase offer">
            <h2>{name(offer.sellerPlayerId)} · answer purchase offer</h2>
            <p>
                {'companyId' in offer ? offer.companyId : offer.buyerPlayerId} offers ${offer.price} for
                {session.purchaseAssetName(offer.asset)}.
            </p>
            <button
                disabled={!session.canRespondToPurchase}
                onclick={() => session.respondToAcquisition(true)}>Accept offer</button
            >
            <button
                disabled={!session.canRespondToPurchase}
                onclick={() => session.respondToAcquisition(false)}>Decline offer</button
            >
        </section>
    {:else if session.acquisitionChoices.length || session.selectedAcquisition}
        <section aria-label="Company purchases">
            <h2>Buy a company or train</h2>
            <p>
                Pay from the corporation's treasury. Companies cost $1 through list price; trains
                from other corporations cost any agreed price of at least $1. Another player's sale
                requires their consent.
            </p>
            {#if session.selectedAcquisition}
                {@const request = session.selectedAcquisition}
                <h3>
                    {session.purchaseAssetName(request.asset)}
                </h3>
                <label
                    >Purchase price <input
                        aria-label="Purchase price"
                        type="number"
                        min="1"
                        step="1"
                        bind:value={session.acquisitionPrice}
                    /></label
                >
                {#if session.acquisitionEvaluation?.reason}<p>
                        {session.acquisitionEvaluation.reason}
                    </p>{/if}
                <button onclick={() => session.cancelAcquisition()}>Back</button>
                <button
                    disabled={!session.canConfirmAcquisition}
                    onclick={() => session.confirmAcquisition()}
                    >Confirm {request.asset.kind === 'train' ? 'train' : 'company'} purchase</button
                >
            {:else}
                {#each session.acquisitionChoices as choice (JSON.stringify(choice.request.asset))}
                    {@const asset = choice.request.asset}
                    <button
                        disabled={!session.canOfferPurchase}
                        onclick={() => session.selectAcquisition(choice.request)}
                        >{session.purchaseAssetName(asset)}
                        {#if asset.kind === 'train' && choice.request.seller.kind === 'company'}
                            from {choice.request.seller.companyId}
                        {/if}
                        {#if choice.maximum !== undefined}
                            · up to ${choice.maximum}{:else}
                            · negotiate price{/if}</button
                    >
                {/each}
            {/if}
        </section>
    {/if}
    {#if state.machineState === 'CorporateFinance'}
        <section aria-label="Corporate finance">
            <h2>{session.financeChoices[0]?.companyId} · issue or redeem shares</h2>
            <p>Choose one transaction, or pass. The stock price stays unchanged.</p>
            {#each session.financeChoices as choice (`${choice.operation}:${choice.shares}`)}
                <button
                    disabled={!session.canChooseAction}
                    onclick={() => session.corporateFinance(choice)}
                >
                    {choice.operation === 'pass'
                        ? 'Pass'
                        : `${choice.operation === 'issue' ? 'Issue' : 'Redeem'} ${choice.shares} share${choice.shares === 1 ? '' : 's'} · $${choice.amount}`}
                </button>
            {/each}
        </section>
    {:else if state.machineState === 'DistributingEarnings'}
        <section aria-label="Major earnings">
            <h2>{state.routeStep?.companyId} · distribute revenue</h2>
            {#each session.earningsChoices as details (details.choice)}
                <button
                    disabled={!session.canChooseAction}
                    onclick={() => session.distributeEarnings(details.choice)}
                >
                    {details.choice === 'pay'
                        ? 'Pay full'
                        : details.choice === 'half-pay'
                          ? 'Pay half'
                          : 'Withhold'} · retain ${details.retained} · ${details.dividendPerShare} per
                    share
                </button>
            {/each}
        </section>
    {:else if state.machineState === 'DiscardingTrains'}
        {@const companyId = state.phaseChange?.discardCompanyIds[0]}
        <section aria-label="Compulsory train discard">
            <h2>{companyId} · return excess trains</h2>
            <p>
                The train limit is now {companyId
                    ? TrainRules1846.trainLimit(state, companyId)
                    : ''}. Choose a train to return to the bank for $0. The interrupted purchase
                resumes after all excess trains are returned.
            </p>
            {#each session.discardChoices as train (train.id)}
                <button
                    disabled={!session.canChooseAction ||
                        !session.validActionTypes.includes('DiscardTrain')}
                    onclick={() => session.discardTrain(train.id)}
                    >Return {train.definitionId} · {train.id}</button
                >
            {/each}
        </section>
    {:else if state.machineState === 'BuyingTrains' && session.trainBuying}
        <section aria-label="Train buying">
            <h2>{session.trainBuying.companyId} · buy trains</h2>
            <p>
                Trains owned: {session.trainBuying.ownedTrainCount} · count toward limit: {session
                    .trainBuying.countedTrainCount} / {session.trainBuying.trainLimit}
            </p>
            <p>
                {#if TrainRules1846.requiresTrain(state, session.trainBuying.companyId)}
                    A corporation must own a train before finishing, even if it cannot run a route.
                {:else}
                    The final depot is empty. A corporation may finish without a train and cannot
                    buy another corporation's last train.
                {/if}
                Buy trains one at a time, up to the current train limit. Phased-out trains do not count.
            </p>
            {#each session.trainBuying.offers as offer (`${offer.trainId}:${offer.definitionId}`)}
                <button disabled={!session.canChooseAction} onclick={() => session.buyTrain(offer)}>
                    Buy {offer.definitionId} train · ${offer.price}{state.trainInventory.trains.find(
                        (train) => train.id === offer.trainId
                    )?.status === 'market'
                        ? ' · returned to bank'
                        : ''}
                </button>
            {/each}
            <EmergencyTrains {session} />
            <button
                disabled={!session.canChooseAction || !session.trainBuying.mayFinish}
                onclick={() => session.finishOperatingTurn()}>Finish operating turn</button
            >
        </section>
    {:else if state.machineState === 'FundingTrain'}
        <section aria-label="Emergency train funding">
            <h2>{state.emergencyFunding?.companyId} · emergency train funding</h2>
            <EmergencyTrains {session} />
        </section>
    {:else if state.machineState === 'AssigningSteamboat'}
        <section>
            <h2>{name(state.activePlayerIds[0])} · assign Steamboat</h2>
            <p>Choose a railroad and port for its route bonus this operating round.</p>
            {#each steamboatCompanies(state) as companyId (companyId)}
                <div>
                    <strong>{companyId}</strong>
                    {#each Object.entries(PortSymbols) as [locationId, symbols] (locationId)}
                        <button
                            disabled={!session.canChooseAction}
                            onclick={() => session.assignSteamboat({ companyId, locationId })}
                            >{locationId} · +${20 * symbols}</button
                        >
                    {/each}
                </div>
            {/each}
            <button disabled={!session.canChooseAction} onclick={() => session.assignSteamboat()}
                >Skip assignment</button
            >
        </section>
    {:else if !session.recordedRun && (['RunningTrains', 'RunningReceiver'].includes(state.machineState) || state.routeStep?.result)}
        <RouteBuilding {session} showUndo={false} />
    {:else if state.machineState === 'StockRound'}
        <section>
            <h2>{state.activePlayerIds.map(name).join(', ')} to trade</h2>
            <p>
                Sell each corporation’s shares in one complete block, then buy at most one
                certificate. Finish your turn to continue clockwise.
            </p>
            {#if session.stockChoices}
                <h3>Launch a corporation · president’s 20%</h3>
                {#each session.stockChoices.starts as choice (`${choice.companyId}:${choice.marketSpaceId}`)}
                    <button
                        disabled={!session.canChooseAction}
                        onclick={() => session.startCompany(choice)}
                        >{choice.companyId} · ${choice.expectedPrice / 2} par · pay ${choice.expectedPrice}</button
                    >
                {/each}
                <h3>Buy one share</h3>
                {#each session.receiverShares as choice (choice.companyId)}
                    <button
                        disabled={!session.canChooseAction}
                        onclick={() => session.buyReceiverShare(choice)}
                    >
                        {choice.companyId} · buy 10% for ${choice.price} and become president
                    </button>
                {/each}
                {#each session.stockChoices.buys as choice (choice.certificateId)}
                    <button
                        disabled={!session.canChooseAction}
                        onclick={() => session.buyShare(choice)}
                        >{choice.companyId} · {choice.source === 'bank' ? 'market' : 'treasury'} · ${choice.expectedPrice}</button
                    >
                {/each}
                <h3>Sell shares</h3>
                {#each session.stockChoices.sells as choice (`${choice.sales[0].companyId}:${choice.sales[0].shares}`)}
                    <button
                        disabled={!session.canChooseAction}
                        onclick={() => session.sellShares(choice)}
                        >{choice.sales[0].companyId} · {choice.sales[0].shares * 10}% · receive ${choice.expectedProceeds}</button
                    >
                {/each}
                <button
                    disabled={!session.canChooseAction || !session.stockChoices.mayFinish}
                    onclick={() => session.finishStockTurn()}
                    >{state.stockRound.turn.acted ? 'Finish turn' : 'Pass'}</button
                >
            {/if}
        </section>
    {:else if state.machineState === 'BuyingOpeningCompanies'}
        <OpeningCompanies {session} />
    {:else if hiddenDraft && (state.machineState === 'Drafting' || state.machineState === 'RevealingDraft')}
        <section>
            <h2>{state.activePlayerIds.map(name).join(', ')} to choose</h2>
            <p>
                Draft counter-clockwise. Choose one card; the others return shuffled to the bottom.
                Pay when everyone reveals.
            </p>
            {#if hiddenDraft.finalOffer}
                <h3>Last company: {label(hiddenDraft.finalOffer.cardId)}</h3>
                <p>
                    Current total: ${hiddenDraft.finalOffer.price}. Passing reduces its list price
                    by $10; debt must still be paid.
                </p>
                <button
                    disabled={!session.canChooseAction || !session.draftChoices.length}
                    onclick={() => session.choose(hiddenDraft!.finalOffer!.cardId)}
                    >Buy for ${hiddenDraft.finalOffer.price}</button
                >
                <button
                    disabled={!session.canChooseAction}
                    onclick={() => session.passFinalCompany()}>Pass · reduce by $10</button
                >
            {/if}
            {#if (mine?.packet?.length || mine?.selections?.length) && !session.packetVisible}
                <p>Pass the device to {session.myPlayer?.name} before opening these cards.</p>
                <button onclick={() => session.revealPacket()}>Show my cards</button>
            {:else if mine?.packet && session.packetVisible}
                {#if !hiddenDraft.finalOffer}
                    <div class="cards">
                        {#each mine.packet as id (id)}
                            <button
                                class="card"
                                disabled={!session.canChooseAction ||
                                    !session.draftChoices.includes(id)}
                                onclick={() => session.choose(id)}
                            >
                                <strong>{label(id)}</strong>
                                {#if !isBlank(id)}<span>${priceFor(state, id)} total</span>
                                    <small>{CompanyDescriptions[id]}</small><small
                                        >{draftCompany(id).kind === 'independent'
                                            ? `$${draftCompany(id).price} treasury + $${draftCompany(id).debt} debt`
                                            : `$${draftCompany(id).revenue} income per operating round`}</small
                                    >{/if}
                            </button>
                        {/each}
                    </div>
                {/if}
                <button onclick={() => session.hidePacket()}>Hide cards</button>
            {:else if !hiddenDraft.finalOffer}<p>
                    Waiting for the active player to choose privately.
                </p>{/if}
            {#if session.packetVisible && mine?.selections?.length}
                <h3>
                    Your commitments · ${mine.selections.reduce((sum, item) => sum + item.price, 0)}
                </h3>
                <ul>
                    {#each mine.selections as selection (selection.cardId)}<li>
                            {label(selection.cardId)} · ${selection.price}
                        </li>{/each}
                </ul>
            {/if}
        </section>
    {/if}
    {#if state.operatingSet !== undefined && !state.operatingSet.completed}
        <p>
            Operating order: {state.operatingSet?.companyOrder.join(' → ')}. Private income has been
            paid.
        </p>
    {/if}
    {#if state.steamboat}<p>
            Steamboat: {state.steamboat.companyId} · {state.steamboat.locationId} · +${20 *
                PortSymbols[state.steamboat.locationId]}
        </p>{/if}
    {#if session.earningsResult}
        {@const result = session.earningsResult}
        <section aria-label="Earnings result">
            <h2>{result.companyId} · earnings</h2>
            <p>
                Revenue ${result.revenue} · retained ${result.retained} · dividend ${result.dividendPerShare}
                per share.
            </p>
            {#each result.payments as payment, index (index)}
                <p>
                    {payment.to.kind === 'player'
                        ? name(payment.to.playerId)
                        : payment.to.kind === 'company'
                          ? payment.to.companyId
                          : 'Bank'} receives ${payment.amount}.
                </p>
            {/each}
            {#if result.marketMove}
                <p>
                    Stock price: ${state.stockMarket.spaces.find(
                        (space) => space.id === result.marketMove?.fromMarketSpaceId
                    )?.price} → ${state.stockMarket.spaces.find(
                        (space) => space.id === result.marketMove?.toMarketSpaceId
                    )?.price}.
                </p>
            {/if}
        </section>
    {/if}
    {#if session.recordedRun}
        <RouteBuilding {session} recordedResult={session.recordedRun} showUndo={false} />
    {/if}
    <Board {session} />
    <section>
        <h2>Players · clockwise seating</h2>
        <ul>
            {#each state.players as player (player.playerId)}
                <li>
                    {name(player.playerId)}{state.bankruptPlayerIds.includes(player.playerId)
                        ? ' · bankrupt'
                        : ''}{player.playerId === state.priorityDealPlayerId
                        ? ' · Priority Deal'
                        : ''} · ${state.cash.find(
                        (cash) =>
                            cash.owner.kind === 'player' && cash.owner.playerId === player.playerId
                    )?.amount}
                </li>
            {/each}
        </ul>
    </section>
    {#if state.machineState === 'StockRound' || state.operatingSet}
        <section>
            <h2>Corporations and holdings</h2>
            {#each state.companies.filter((company) => company.kind === 'major' && !company.closed) as company (company.id)}
                <p>
                    <strong>{company.id}</strong> · {company.started
                        ? `$${companyMarketSpace(state.stockMarket, company.id).price} per share`
                        : 'not launched'} · treasury ${finiteCashOwnedBy(state, {
                        kind: 'company',
                        companyId: company.id
                    })}
                    {#if inReceivership(state, company.id)}
                        · receivership{/if}
                    {#if company.president?.kind === 'player'}
                        · president {name(company.president.playerId)}{/if}
                </p>
                <p>
                    Trains: {trainsOwnedBy(state, { kind: 'company', companyId: company.id })
                        .map(
                            (train) =>
                                `${train.definitionId}${train.status === 'owned' && train.rustsAfterOperation ? ' (phased out)' : ''}`
                        )
                        .join(', ') || 'none'} · Privates: {state.companies
                        .filter(
                            (privateCompany) =>
                                privateCompany.kind === 'private' &&
                                privateOwningCompany(state, privateCompany.id) === company.id
                        )
                        .map((privateCompany) => privateCompany.id)
                        .join(', ') || 'none'}
                </p>
                <p>
                    {state.players
                        .map(
                            (player) =>
                                `${name(player.playerId)} ${sharesOwned(state, company.id, { kind: 'player', playerId: player.playerId }) * 10}%`
                        )
                        .join(' · ')}
                </p>
            {/each}
        </section>
    {/if}
    <section>
        <h2>Setup</h2>
        <p>Removed companies: {state.removedPrivateIds.map(label).join(', ')}.</p>
        <p>
            Removed corporations: {state.removedCorporationIds.join(', ') || 'none'}. Their home
            stations block their cities.
        </p>
    </section>
</main>

<style>
    main {
        max-width: 1050px;
        margin: auto;
        padding: 1.5rem;
        color: #202c39;
        background: #f5f1e9;
        min-height: 100%;
    }
    header {
        padding: 1rem 0;
    }
    .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.1em;
        font-size: 0.8rem;
    }
    h1 {
        font-size: 1.8rem;
        font-weight: 700;
    }
    h2 {
        font-size: 1.2rem;
        font-weight: 650;
        margin-bottom: 0.6rem;
    }
    h3 {
        margin-top: 1rem;
        font-weight: 650;
    }
    section {
        background: white;
        padding: 1.2rem;
        margin: 1rem 0;
        border: 1px solid #d8d5ce;
        border-radius: 0.5rem;
    }
    p {
        margin: 0.5rem 0;
    }
    button {
        background: #173f4b;
        color: white;
        border-radius: 0.35rem;
        padding: 0.65rem 1rem;
        margin: 0.4rem 0.4rem 0.4rem 0;
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.5;
        cursor: default;
    }
    button:focus-visible {
        outline: 3px solid #de9717;
        outline-offset: 3px;
    }
    .cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 0.6rem;
        margin: 1rem 0;
    }
    .card {
        display: flex;
        flex-direction: column;
        text-align: left;
        min-height: 125px;
        gap: 0.5rem;
        margin: 0;
    }
    li {
        margin: 0.35rem 0;
    }
    small {
        font-size: 0.8rem;
    }
</style>
