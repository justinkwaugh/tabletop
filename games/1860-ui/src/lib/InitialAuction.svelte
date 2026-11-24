<script lang="ts">
    import {
        AuctionParPrices,
        DirectorShares,
        MinimumRaise,
        PrivateCatalog1860,
        exchangeCompanyId,
        isChooseCertificate,
        isCompany1860,
        lotCost
    } from '@tabletop/1860'
    import { finiteCashOwnedBy } from '@tabletop/18xx'
    import { turnOrderFrom } from '@tabletop/common'
    import { AuctionBidControl, CompanyToken, PrivateCard } from '@tabletop/18xx-ui'
    import type { Session1860 } from './session.svelte.js'
    let { session }: { session: Session1860 } = $props()

    const AuctionCount = 6
    const money = $derived(session.presentation.money)
    const auction = $derived(session.gameState.choiceAuction)
    const decision = $derived(session.auctionDecision)
    const name = (playerId: string) => session.getPlayerName(playerId)
    const color = (playerId: string) => session.playerColorValue(playerId)
    const cash = (playerId: string) =>
        finiteCashOwnedBy(session.gameState, { kind: 'player', playerId })
    const token = (companyId: string) => session.mapView.stations[companyId]
    // The winner's choice stays up while it is sent and shown; its buttons are disabled meanwhile.
    const choosing = $derived(session.lotChoices.length > 0 && session.myAuctionTurn)
    const locked = $derived(!session.canChooseAction)
    const choice = (lotId: string) => session.lotChoices.find((entry) => entry.lotId === lotId)
    const chosen = $derived(session.chosenLot ? choice(session.chosenLot) : undefined)
    const parPrices = $derived(
        `${money(AuctionParPrices[0])}–${money(AuctionParPrices.at(-1) ?? AuctionParPrices[0])}`
    )

    /** What each finished auction's winner took, in order, from the recorded choices. */
    const results = $derived(
        session.actions.flatMap((action) =>
            isChooseCertificate(action) && action.playerId && action.metadata
                ? [
                      {
                          playerId: action.playerId,
                          lotId: action.lotId,
                          parPrice: action.parPrice,
                          bid: action.metadata.bid,
                          cost: action.metadata.cost
                      }
                  ]
                : []
        )
    )
    const number = $derived(Math.min(results.length + 1, AuctionCount))

    /** The players in bidding order for this auction, from its opener. */
    const bidders = $derived(
        auction ? turnOrderFrom(session.gameState.turnManager.turnOrder, auction.starterId) : []
    )
    type Standing = 'high' | 'passed' | 'acting' | 'waiting' | 'won'
    function standing(playerId: string): Standing {
        if (decision?.kind === 'choose') return decision.playerId === playerId ? 'won' : 'passed'
        if (auction?.passedIds.includes(playerId)) return 'passed'
        if (decision?.playerId === playerId) return 'acting'
        if (auction?.bid?.playerId === playerId) return 'high'
        return 'waiting'
    }
    const StandingLabels: Record<Standing, string> = {
        high: 'High bid',
        passed: 'Passed',
        acting: 'To act',
        waiting: 'Waiting',
        won: 'Chooses'
    }

    function lotLabel(lotId: string): string {
        return isCompany1860(lotId)
            ? `${session.companyInitials(lotId)} director’s share`
            : session.companyName(lotId)
    }
    function choose(lotId: string) {
        if (isCompany1860(lotId))
            session.chosenLot = session.chosenLot === lotId ? undefined : lotId
        else void session.chooseCertificate(lotId)
    }
</script>

{#snippet dot(playerId: string)}
    <span class="dot" style:background={color(playerId)} aria-hidden="true"></span>
{/snippet}

{#snippet lot(lotId: string)}
    {#if isCompany1860(lotId)}
        <div class="share-card">
            <header>
                <CompanyToken appearance={token(lotId)} size={30} />
                <div>
                    <h4>{session.companyFullName(lotId)}</h4>
                    <span>Director’s share · {DirectorShares * 10}%</span>
                </div>
            </header>
            <dl>
                <div>
                    <dt>Par</dt>
                    <dd>{parPrices}</dd>
                </div>
                <div>
                    <dt>Cost</dt>
                    <dd>twice the par</dd>
                </div>
            </dl>
        </div>
    {:else}
        {@const exchange = exchangeCompanyId(lotId)}
        <PrivateCard
            {money}
            name={session.companyName(lotId)}
            description={PrivateCatalog1860.definition(lotId).description ?? ''}
            value={PrivateCatalog1860.faceValue(lotId)}
            income={session.privateIncome(lotId)}
            tokens={exchange ? [token(exchange)] : []}
        />
    {/if}
{/snippet}

<section class="centered-panel initial-auction title-panel" aria-label="Initial auction">
    {#if auction && decision}
        <header class="heading">
            <h3>Initial auction <span class="count">{number} of {AuctionCount}</span></h3>
            <ol class="progress" aria-label="Auctions">
                {#each Array.from({ length: AuctionCount }, (_, index) => index) as index (index)}
                    {@const result = results[index]}
                    <li
                        class:done={!!result}
                        class:current={index === results.length}
                        title={result
                            ? `${name(result.playerId)} took ${lotLabel(result.lotId)}`
                            : `Auction ${index + 1}`}
                    >
                        {#if result}
                            {#if isCompany1860(result.lotId)}<CompanyToken
                                    appearance={token(result.lotId)}
                                    size={16}
                                />{:else}<span class="private-mark"
                                    >{session.companyInitials(result.lotId)}</span
                                >{/if}
                            {@render dot(result.playerId)}
                        {/if}
                    </li>
                {/each}
            </ol>
        </header>

        <p class="rule">
            Players bid for the right to choose a certificate. The winner pays the bid, then takes a
            private at its face value or a director’s share at twice its par.
        </p>

        <ul class="bidders" aria-label="Bidders">
            {#each bidders as playerId (playerId)}
                {@const state = standing(playerId)}
                <li class={state} class:me={playerId === session.myPlayer?.id}>
                    {@render dot(playerId)}
                    <span class="bidder">{name(playerId)}</span>
                    <span class="cash">{money(cash(playerId))}</span>
                    <span class="standing">
                        {#if state === 'high' && auction.bid}High bid <strong
                                >{money(auction.bid.amount)}</strong
                            >{:else if state === 'won'}Won{decision.kind === 'choose' &&
                            decision.bid
                                ? ` for ${money(decision.bid)}`
                                : ' unopposed'}{:else}{StandingLabels[state]}{/if}
                    </span>
                </li>
            {/each}
        </ul>

        {#if choosing}
            <p class="prompt">Take a certificate.</p>
        {:else if session.myAuctionTurn && decision.kind === 'bid'}
            {@const amount = Math.min(
                Math.max(session.bidAmount ?? session.minimumBid, session.minimumBid),
                session.maximumBid
            )}
            <div class="turn">
                <AuctionBidControl
                    {money}
                    {amount}
                    increment={MinimumRaise}
                    canBid={!locked && session.mayBid(amount)}
                    canDecrease={!locked && amount - MinimumRaise >= session.minimumBid}
                    canIncrease={!locked && session.mayBid(amount + MinimumRaise)}
                    canPass={!locked}
                    onChange={(value) => (session.bidAmount = value)}
                    onBid={() => session.bid(amount)}
                    onPass={() => session.passBid()}
                />
                <p class="limit">
                    Up to {money(session.maximumBid)}, keeping enough for the cheapest certificate.
                </p>
            </div>
        {:else}
            <p class="prompt waiting">
                {@render dot(decision.playerId)}
                {decision.kind === 'choose'
                    ? `${name(decision.playerId)} chooses a certificate`
                    : `${name(decision.playerId)} may bid or pass`}
            </p>
        {/if}

        <div class="lots" role="group" aria-label="Certificates on offer">
            {#each auction.lotIds as lotId (lotId)}
                {@const option = choosing ? choice(lotId) : undefined}
                {#if option}
                    <button
                        class="lot choosable"
                        aria-pressed={isCompany1860(lotId)
                            ? session.chosenLot === lotId
                            : undefined}
                        aria-label={isCompany1860(lotId)
                            ? `Choose ${session.companyName(lotId)}’s director’s share`
                            : `Take ${session.companyName(lotId)} for ${money(lotCost(lotId))}`}
                        disabled={locked}
                        onclick={() => choose(lotId)}>{@render lot(lotId)}</button
                    >
                {:else}
                    <div class="lot" class:unavailable={choosing}>{@render lot(lotId)}</div>
                {/if}
            {/each}
        </div>
        {#if choosing && chosen && session.chosenLot}
            {@const lotId = session.chosenLot}
            <p class="prompt">
                Set {session.companyName(lotId)}’s par and buy its director’s share.
            </p>
            <div class="choices" role="group" aria-label="Par price">
                {#each chosen.parPrices as par (par)}
                    <button
                        class="action-button"
                        disabled={locked}
                        onclick={() => session.chooseCertificate(lotId, par)}
                        >Par {money(par)} · pay {money(lotCost(lotId, par))}</button
                    >
                {/each}
            </div>
        {/if}

        {#if results.length}
            <table class="results" aria-label="Certificates taken">
                <tbody>
                    {#each results as result, index (index)}
                        <tr>
                            <td class="who"
                                >{@render dot(result.playerId)}{name(result.playerId)}</td
                            >
                            <td class="what"
                                >{lotLabel(result.lotId)}{#if result.parPrice}<span class="par"
                                        >par {money(result.parPrice)}</span
                                    >{/if}</td
                            >
                            <td class="paid"
                                >{result.bid ? `bid ${money(result.bid)} · ` : ''}<strong
                                    >{money(result.bid + result.cost)}</strong
                                ></td
                            >
                        </tr>
                    {/each}
                </tbody>
            </table>
        {/if}
    {/if}
</section>

<style>
    .initial-auction {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        font-variant-numeric: tabular-nums;
    }
    .heading {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 6px 14px;
    }
    h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 650;
    }
    .count {
        margin-left: 4px;
        font-weight: 500;
        color: var(--rail-muted, #817565);
    }
    .progress {
        display: flex;
        gap: 5px;
        margin: 0;
        padding: 0;
        list-style: none;
    }
    .progress li {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        min-width: 22px;
        height: 22px;
        padding: 0 4px;
        box-sizing: border-box;
        border: 1px solid var(--rail-border, #c9baa5);
        border-radius: 11px;
        font-size: 9px;
        font-weight: 700;
    }
    .progress li.current {
        border-color: var(--color-primary-500, #f97316);
        border-width: 2px;
    }
    .progress li.done {
        background: var(--rail-surface-raised, #efe7db);
        color: var(--rail-text, #514538);
    }
    .private-mark {
        letter-spacing: 0.02em;
    }
    .rule {
        margin: 0;
        max-width: 36em;
        text-align: center;
        font-size: 12px;
        color: var(--rail-muted, #786550);
    }
    .bidders {
        display: grid;
        grid-template-columns: auto 1fr auto auto;
        align-items: center;
        gap: 0 10px;
        width: 100%;
        max-width: 420px;
        margin: 0;
        padding: 4px 0;
        list-style: none;
        border: 1px solid var(--rail-border, #c9baa5);
        border-radius: 8px;
        background: var(--rail-surface, #fffdf8);
        color: var(--rail-text, #514538);
        font-size: 13px;
    }
    .bidders li {
        display: contents;
    }
    .bidders li > * {
        padding: 4px 0;
    }
    .bidders li > :first-child {
        margin-left: 12px;
    }
    .bidders li > :last-child {
        padding-right: 12px;
        text-align: right;
    }
    .bidder {
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .me .bidder::after {
        content: ' (you)';
        font-weight: 400;
        color: var(--rail-muted, #817565);
    }
    .cash {
        color: var(--rail-muted, #817565);
        font-size: 12px;
    }
    .standing {
        white-space: nowrap;
        font-size: 12px;
    }
    .passed .bidder,
    .passed .standing {
        color: var(--rail-muted, #9a8b78);
    }
    .passed .bidder {
        text-decoration: line-through;
        text-decoration-thickness: 1px;
    }
    .acting .standing {
        font-weight: 700;
        color: var(--color-primary-600, #c2410c);
    }
    .high .standing strong,
    .won .standing {
        font-weight: 700;
    }
    .dot {
        display: inline-block;
        flex-shrink: 0;
        width: 10px;
        height: 10px;
        border-radius: 50%;
    }
    .turn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
    }
    .limit {
        margin: 0;
        font-size: 11px;
        color: var(--rail-muted, #786550);
    }
    .prompt {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: 0;
        font-size: 13px;
        font-weight: 600;
    }
    .prompt.waiting {
        font-weight: 500;
        color: var(--rail-muted, #786550);
    }
    .lots {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
        gap: 8px;
        width: 100%;
        max-width: 640px;
    }
    .lot {
        display: block;
        padding: 0;
        border: 0;
        background: none;
        text-align: left;
        font: inherit;
        color: inherit;
    }
    .lot.choosable {
        cursor: pointer;
        border-radius: 9px;
        outline: 2px solid transparent;
        outline-offset: 1px;
    }
    .lot.choosable:hover:not(:disabled),
    .lot.choosable:focus-visible,
    .lot.choosable[aria-pressed='true'] {
        outline-color: var(--color-primary-500, #f97316);
    }
    .lot.choosable:disabled,
    .action-button:disabled {
        cursor: default;
    }
    .lot.unavailable {
        opacity: 0.5;
    }
    .share-card {
        height: 100%;
        box-sizing: border-box;
        border: 1px solid var(--rail-border, #c9baa5);
        border-radius: 8px;
        background: var(--rail-surface, #fffdf8);
        color: var(--rail-text, #514538);
        font-size: 12px;
        line-height: 1.45;
        overflow: hidden;
    }
    .share-card header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 9px 12px;
        background: var(--rail-surface-raised, #efe7db);
    }
    .share-card h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 650;
        line-height: 1.3;
    }
    .share-card dl {
        display: flex;
        gap: 16px;
        margin: 0;
        padding: 8px 12px;
    }
    .share-card dt {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--rail-muted, #817565);
    }
    .share-card dd {
        margin: 0;
        font-weight: 600;
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }
    .action-button {
        margin: 0;
        padding: 5px 14px;
        border-radius: 4px;
        cursor: pointer;
    }
    .results {
        width: 100%;
        max-width: 480px;
        border-collapse: collapse;
        font-size: 12px;
    }
    .results td {
        padding: 3px 6px;
        border-top: 1px solid var(--rail-border, rgb(201 186 165 / 0.5));
    }
    .results .who {
        white-space: nowrap;
    }
    .results .who .dot {
        margin-right: 6px;
    }
    .results .par {
        margin-left: 6px;
        color: var(--rail-muted, #817565);
    }
    .results .paid {
        text-align: right;
        white-space: nowrap;
    }
</style>
