<script lang="ts">
    import { companyMarketSpace, sharesOwned, finiteCashOwnedBy } from '@tabletop/18xx'
    import Board from './Board.svelte'
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
    const mine = $derived(
        state.draft.participants.find((player) => player.playerId === session.myPlayer?.id)
    )
    const canChoose = $derived(
        session.isPlayable && session.isMyTurn && !session.isViewingHistory && !session.busy
    )
    const name = (id: string) => session.game.players.find((player) => player.id === id)?.name ?? id
    const label = (id: string) => (isBlank(id) ? 'Blank — take no company' : draftCompany(id).name)
</script>

<main>
    <header>
        <p class="eyebrow">1846 · The Race to the Midwest</p>
        <h1>
            {state.machineState === 'ReadyForRoutes'
                ? 'Ready for routes'
                : state.machineState === 'LayingTrack'
                  ? 'First operating round'
                  : state.machineState === 'StockRound'
                    ? 'First stock round'
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
                (!session.undoableAction && !session.selectedLocation)}
            onclick={() => session.undo()}>Undo</button
        >
        {#if session.isViewingHistory}<span>History · read only</span>{/if}
    </nav>
    {#if state.machineState === 'ReadyForRoutes'}
        <section>
            <h2>Track construction complete</h2>
            <p>{name(state.priorityDealPlayerId)} holds Priority Deal for the next stock round.</p>
            <p class="notice">
                This prototype ends before routes. Routes, earnings, and further operations are the
                next slices.
            </p>
            <ul>
                {#each state.purchases as purchase (purchase.cardId)}<li>
                        {name(purchase.playerId)} · {label(purchase.cardId)} · ${purchase.price}
                    </li>{/each}
            </ul>
        </section>
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
                    <button disabled={!canChoose} onclick={() => session.startCompany(choice)}
                        >{choice.companyId} · ${choice.expectedPrice / 2} par · pay ${choice.expectedPrice}</button
                    >
                {/each}
                <h3>Buy one share</h3>
                {#each session.stockChoices.buys as choice (choice.certificateId)}
                    <button disabled={!canChoose} onclick={() => session.buyShare(choice)}
                        >{choice.companyId} · {choice.source === 'bank' ? 'market' : 'treasury'} · ${choice.expectedPrice}</button
                    >
                {/each}
                <h3>Sell shares</h3>
                {#each session.stockChoices.sells as choice (`${choice.sales[0].companyId}:${choice.sales[0].shares}`)}
                    <button disabled={!canChoose} onclick={() => session.sellShares(choice)}
                        >{choice.sales[0].companyId} · {choice.sales[0].shares * 10}% · receive ${choice.expectedProceeds}</button
                    >
                {/each}
                <button
                    disabled={!canChoose || !session.stockChoices.mayFinish}
                    onclick={() => session.finishStockTurn()}
                    >{state.stockRound.turn.acted ? 'Finish turn' : 'Pass'}</button
                >
            {/if}
        </section>
    {:else if state.machineState === 'Drafting' || state.machineState === 'RevealingDraft'}
        <section>
            <h2>{state.activePlayerIds.map(name).join(', ')} to choose</h2>
            <p>
                Draft counter-clockwise. Choose one card; the others return shuffled to the bottom.
                Pay when everyone reveals.
            </p>
            {#if state.draft.finalOffer}
                <h3>Last company: {label(state.draft.finalOffer.cardId)}</h3>
                <p>
                    Current total: ${state.draft.finalOffer.price}. Passing reduces its list price
                    by $10; debt must still be paid.
                </p>
                <button
                    disabled={!canChoose || !session.draftChoices.length}
                    onclick={() => session.choose(state.draft.finalOffer!.cardId)}
                    >Buy for ${state.draft.finalOffer.price}</button
                >
                <button disabled={!canChoose} onclick={() => session.passFinalCompany()}
                    >Pass · reduce by $10</button
                >
            {/if}
            {#if (mine?.packet?.length || mine?.selections?.length) && !session.packetVisible}
                <p>Pass the device to {session.myPlayer?.name} before opening these cards.</p>
                <button onclick={() => session.revealPacket()}>Show my cards</button>
            {:else if mine?.packet && session.packetVisible}
                {#if !state.draft.finalOffer}
                    <div class="cards">
                        {#each mine.packet as id (id)}
                            <button
                                class="card"
                                disabled={!canChoose || !session.draftChoices.includes(id)}
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
            {:else if !state.draft.finalOffer}<p>
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
    {#if state.machineState === 'LayingTrack' || state.machineState === 'ReadyForRoutes'}
        <p>
            Operating order: {state.operatingSet?.companyOrder.join(' → ')}. Private income has been
            paid.
        </p>
    {/if}
    <Board {session} />
    <section>
        <h2>Players · clockwise seating</h2>
        <ul>
            {#each state.players as player (player.playerId)}
                <li>
                    {name(player.playerId)}{player.playerId === state.priorityDealPlayerId
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
                    {#if company.president?.kind === 'player'}
                        · president {name(company.president.playerId)}{/if}
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
        {#if state.machineState === 'ReadyForRoutes'}<p>
                Michigan Southern starts with $60, a 2 train and its Detroit station. Big 4 starts
                with $40, a 2 train and its Indianapolis station.
            </p>{/if}
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
    .notice {
        background: #f8edcf;
        padding: 0.7rem;
    }
    li {
        margin: 0.35rem 0;
    }
    small {
        font-size: 0.8rem;
    }
</style>
