<script lang="ts">
    import { chainSidewaysScroll } from '@tabletop/frontend-components'
    import { NationalCompanyKind, privatePowerUsed, isObsoleteTrain } from '@tabletop/18xx'
    import type { Snippet } from 'svelte'
    import {
        companyMarketSpace,
        DefaultCompanyPricePresentation,
        shownParPrice,
        type CompanyPricePresentation
    } from './companyPresentation.js'
    import { assertExists, type BoundingBox, type GameAction } from '@tabletop/common'
    import {
        cashOwnedBy,
        certificatesOwnedBy,
        controllingOwner,
        getCompany,
        privateOwner,
        sameOwner,
        trainsOwnedBy,
        sharesOwned,
        type Company,
        type Owner
    } from '@tabletop/18xx'
    import type {
        CompanyShareStatus,
        EighteenXXSessionView
    } from '../session/eighteenXXSession.svelte.js'
    import {
        type CompanyOwnership,
        companyOwnership,
        holdsReceiverPresidentCertificate
    } from '../finance/companyOwnership.js'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import PrivateDescription from '../privates/PrivateDescription.svelte'
    import PrivateTrackPowerButton from '../privates/PrivateTrackPowerButton.svelte'
    import { companyLastRun } from './companyLastRun.js'
    import type { CompanyMark, PlaceConnection } from '../session/titlePresentation.js'
    import PresidentName from '../finance/PresidentName.svelte'
    import CertificateBadge from '../finance/CertificateBadge.svelte'
    import { multiShareMark } from '../finance/multiShareCertificates.js'
    import CompanyTradePopover from '../stock/CompanyTradePopover.svelte'
    import RemainingStationTokens from './RemainingStationTokens.svelte'
    import { sessionStationTokens } from './stationTokens.js'
    import { shareSourceName } from '../stock/purchaseSources.js'
    import { marketValueMark } from '../stock/marketColors.js'
    import '../stock/marketZoneTint.css'
    let {
        session,
        onPreviewMap,
        onFocusConnection,
        company,
        pricePresentation = DefaultCompanyPricePresentation,
        layout = 'wide',
        unavailable = false,
        purchaseSources,
        canPurchase,
        trainColors,
        offersTrades = true
    }: {
        offersTrades?: boolean
        pricePresentation?: CompanyPricePresentation
        unavailable?: boolean
        /** `wide-fill` is the wide card stretched to its container's width. */
        layout?: 'wide' | 'wide-fill' | 'vertical'
        canPurchase?: (entry: CompanyOwnership) => boolean
        purchaseSources?: Snippet<[CompanyOwnership]>
        onPreviewMap?: (action: GameAction) => void
        onFocusConnection?: (connection: PlaceConnection) => void
        session: EighteenXXSessionView
        trainColors: Readonly<Record<string, string>>
        company: Company
    } = $props()
    const vertical = $derived(layout === 'vertical')
    const shareStatusLabels: Record<CompanyShareStatus, string> = {
        unfloated: 'Unfloated',
        soldOut: 'Sold out'
    }
    const money = $derived(session.presentation.money)
    const gameState = $derived(session.gameState)
    const lastRun = $derived(
        vertical
            ? undefined
            : companyLastRun(session.actions, session.gameState.actionCount, company.id)
    )
    const owner = $derived({ kind: 'company', companyId: company.id } as const)
    const cash = $derived(cashOwnedBy(gameState, owner))
    const control = $derived(controllingOwner(gameState, company.id))
    function investorTint(entry: { owner: Owner }) {
        const investor = entry.owner
        const playerId =
            investor.kind === 'player'
                ? investor.playerId
                : investor.kind === 'company' && !sameOwner(investor, owner)
                  ? controllingOwner(gameState, investor.companyId)?.playerId
                  : undefined
        return playerId ? session.colors.getPlayerBgColorValue(playerId) : undefined
    }
    const sellers = $derived(
        gameState.machineState === 'StockRound' && !gameState.stockRound.completed
            ? gameState.stockRound.sales
                  .filter((sale) => sale.companyId === company.id)
                  .map((sale) => sale.owner)
            : []
    )
    const ownership = $derived(companyOwnership(gameState, company.id, sellers))
    const sharePoolsStart = $derived(
        ownership.findIndex((entry) => entry.owner.kind === 'bank' || sameOwner(entry.owner, owner))
    )
    const numberedShares = $derived(ownership.some((row) => row.certificateNumbers.length))
    const marketSpace = $derived(
        companyMarketSpace(session.stockMarketChart, gameState.stockMarket, company.id)
    )
    const parPrice = $derived(shownParPrice(pricePresentation, gameState, company))
    const marketPrice = $derived(marketSpace?.price)
    const valueMark = $derived(marketValueMark(marketSpace, session.presentation.marketZones))
    const shareStatus = $derived(session.companyShareStatus(company.id))
    const trains = $derived(trainsOwnedBy(gameState, owner))
    const marks = $derived(session.presentation.companyMarks?.(gameState, company.id) ?? [])
    const tokenBadges = $derived(
        session.presentation.companyTokenBadges?.(gameState, company.id) ?? []
    )
    const compactMarks = $derived(marks.filter((mark) => mark.compact))
    const rosterMarks = $derived(marks.filter((mark) => !mark.compact))
    const stationCosts = $derived(!session.presentation.hideStationCosts)
    // Three priced token groups leave a narrow card's name too little room beside them.
    const tokensBelowName = $derived(
        vertical && stationCosts && sessionStationTokens(session, company.id).groups.length > 2
    )
    const titleFacts = $derived(
        session.presentation.companyFacts?.(session.gameState, company.id) ?? []
    )
    const origin = $derived(session.presentation.companyOrigin?.(gameState, company.id))
    const investments = $derived(
        certificatesOwnedBy(gameState, owner).filter(
            (certificate) => certificate.kind === 'share' && certificate.companyId !== company.id
        )
    )
    const investmentCompanies = $derived([
        ...new Set(investments.map((certificate) => certificate.companyId))
    ])
    const companyPowers = $derived(session.presentation.companyPowers)
    const privates = $derived.by(() => {
        if (companyPowers) {
            const ids = companyPowers.privateIds(gameState, company.id)
            return session.privates.companies.filter((item) => ids.includes(item.id))
        }
        return session.privates.companies.filter((item) => {
            const privateCompanyOwner = privateOwner(gameState, item.id)
            return privateCompanyOwner && sameOwner(privateCompanyOwner, owner)
        })
    })
    const personalPrivates = $derived(
        session.privates.companies.flatMap((item) => {
            const privateCompanyOwner = privateOwner(gameState, item.id)
            const priceRange = session.decisions.privatePurchasePriceRange(company.id, item.id)
            return !item.closed &&
                privateCompanyOwner &&
                control &&
                sameOwner(privateCompanyOwner, control) &&
                priceRange
                ? [{ ...item, maximumPrice: priceRange.maximum }]
                : []
        })
    )
    const trades = $derived(offersTrades ? session.stock.companyTrades(company.id) : undefined)
    const tradeLabel = $derived(
        [trades?.offers.length ? 'Buy' : '', trades?.sales.length ? 'Sell' : '']
            .filter(Boolean)
            .join(' · ')
    )
    type TradeOpening = { number: number; anchor: BoundingBox; pointerY: number }
    let openings = 0
    let tradeOpening = $derived.by((): TradeOpening | undefined => {
        session.updatingVisibleState
        return undefined
    })
    const shownTradeOpening = $derived(tradeLabel ? tradeOpening : undefined)
    let card = $state<HTMLElement>()
    // The popover closes itself on the press, before the click, so the press records whether it
    // was open for the click to close it rather than open it again.
    let pressedWhileOpen = false
    function notePress() {
        pressedWhileOpen = !!shownTradeOpening
    }
    function toggleTrades(pointerY: number) {
        const closing = pressedWhileOpen
        pressedWhileOpen = false
        if (closing) {
            tradeOpening = undefined
            return
        }
        assertExists(card, 'A company card opens its trades')
        openings += 1
        tradeOpening = { number: openings, anchor: card.getBoundingClientRect(), pointerY }
    }
    function toggleTradesFromCard(event: MouseEvent) {
        if (
            !tradeLabel ||
            (event.target instanceof Element && event.target.closest('button, a, input, select'))
        ) {
            pressedWhileOpen = false
            return
        }
        toggleTrades(event.clientY)
    }
</script>

{#snippet multiShareBadge(entry: CompanyOwnership)}
    {@const mark = multiShareMark(
        session.presentation,
        gameState,
        company.id,
        entry.owner,
        entry.poolId
    )}
    {#if mark}<CertificateBadge label={mark.label} title={mark.title} />{/if}
{/snippet}

<!-- The Buy · Sell button is the keyboard path; a click anywhere else on the card is a shortcut. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<article
    bind:this={card}
    class="company-detail"
    class:vertical
    class:trains-under-stations={vertical && !stationCosts}
    class:tokens-below-name={tokensBelowName}
    class:wide-fill={layout === 'wide-fill'}
    class:unavailable
    class:tradable={!!tradeLabel}
    class:trading={!!shownTradeOpening}
    aria-label={`${session.companyName(company.id)} details`}
    onpointerdown={notePress}
    onclick={toggleTradesFromCard}
>
    <header>
        <div class="identity">
            {#if vertical && compactMarks.length}
                <span class="token-column"
                    >{@render token()}<span class="compact-marks"
                        >{@render markList(compactMarks)}</span
                    ></span
                >
            {:else}{@render token()}{/if}
            <div>
                {#if !vertical && compactMarks.length}
                    <div class="name-line">
                        {@render name()}<span class="compact-marks"
                            >{@render markList(compactMarks)}</span
                        >
                    </div>
                {:else}{@render name()}{/if}
                <div class="train-roster" aria-label="Trains">
                    {#each trains as train (train.id)}
                        {@const definition = session.trainDepot.trainDefinition(train.definitionId)}
                        <TrainBadge
                            name={definition.name}
                            color={trainColors[train.definitionId]}
                            obsolete={isObsoleteTrain(train)}
                            tokens={session.presentation.trainTokens?.(gameState, train)}
                            title={definition.distance.maximum === 'unlimited'
                                ? 'Unlimited'
                                : `${definition.distance.maximum} ${definition.distance.measure === 'hex-edges' ? 'hex edges' : definition.distance.measure === 'cities-and-offboards' ? 'cities / offboards + towns' : 'revenue centers'}`}
                        />
                    {:else}<span
                            class="empty"
                            class:train-required={session.companyRequiresTrain(company.id)}
                            title={session.companyRequiresTrain(company.id)
                                ? 'Must buy a train when operating'
                                : undefined}>No trains</span
                        >{/each}
                    {@render markList(rosterMarks)}
                </div>
                {#if company.closed}<p class="subtitle">Closed</p>{/if}
            </div>
        </div>
        <div class="header-summary">
            <RemainingStationTokens {session} companyId={company.id} {vertical} />
        </div>
    </header>
    {#if origin && 'connection' in origin && onFocusConnection}
        {@const connection = origin.connection}
        <button
            type="button"
            class="origin connection"
            title={`Show ${session.placeName(connection.from)} and ${session.placeName(connection.to)} on the map`}
            onclick={() => onFocusConnection(connection)}><span>{origin.text}</span></button
        >
    {:else if origin}
        <p class="origin">
            {origin.text}
            {#if 'companyIds' in origin}
                {#each origin.companyIds as id, index (id)}{#if index}<span>&amp;</span>{/if}<span
                        class="origin-company"
                        ><CompanyToken appearance={session.mapView.stations[id]} size={15} /><strong
                            >{session.companyInitials(id)}</strong
                        ></span
                    >{/each}
            {/if}
        </p>
    {/if}
    <div class="financial-summary">
        {@render prices()}
        {#if titleFacts.some((fact) => fact.below)}<p class="fact-notes">
                {#each titleFacts.filter((fact) => fact.below) as fact (fact.label)}<span
                        >{fact.label} <strong>{fact.value}</strong></span
                    >{/each}
            </p>{/if}
    </div>
    <div class="detail-columns" {@attach chainSidewaysScroll}>
        <section aria-label="Company ownership">
            <div class="ownership-heading">
                <h3>Owners</h3>
                <span class="heading-end">
                    {#if shareStatus}<span
                            class="share-status"
                            class:unfloated={shareStatus === 'unfloated'}
                            >{shareStatusLabels[shareStatus]}</span
                        >{/if}
                    {#if tradeLabel}<button
                            type="button"
                            class="trade-opener"
                            aria-label={`Trade ${session.companyName(company.id)} shares`}
                            onclick={(event) => {
                                const bounds = event.currentTarget.getBoundingClientRect()
                                toggleTrades(bounds.y + bounds.height / 2)
                            }}>{tradeLabel}</button
                        >{/if}
                </span>
            </div>
            {#if ownership.length}
                <table aria-label={`${session.companyName(company.id)} share ownership`}>
                    <tbody>
                        {#each ownership as entry, index (index)}
                            {@const presidency =
                                entry.poolId &&
                                holdsReceiverPresidentCertificate(
                                    gameState,
                                    company.id,
                                    entry.poolId
                                )
                                    ? `Holds the ${session.terms.presidentWord}’s certificate`
                                    : company.president && sameOwner(entry.owner, company.president)
                                      ? session.terms.president
                                      : undefined}
                            <tr
                                class:pool-divider={index > 0 && index === sharePoolsStart}
                                class:president={!!presidency}
                                class:sold={sellers.some((seller) =>
                                    sameOwner(seller, entry.owner)
                                )}
                                class:investor-owner={entry.owner.kind === 'player' ||
                                    (entry.owner.kind === 'company' &&
                                        !sameOwner(entry.owner, owner))}
                                class:player-tinted-row={!!investorTint(entry)}
                                style:--player-color={investorTint(entry)}
                            >
                                {#if purchaseSources && canPurchase?.(entry)}
                                    <td class="purchase-cell" colspan={numberedShares ? 3 : 2}
                                        >{@render purchaseSources(entry)}</td
                                    >
                                {:else}
                                    <th scope="row" title={presidency}
                                        ><PresidentName
                                            name={shareSourceName(
                                                { ...entry, companyId: company.id },
                                                session
                                            )}
                                            president={!!presidency}
                                            label={session.presidentMark(company.id)}
                                            title={session.terms.president}
                                        />{@render multiShareBadge(entry)}</th
                                    >
                                    {#if numberedShares}<td
                                            class="certificate-numbers"
                                            title="Certificate numbers"
                                            >{#if entry.certificateNumbers.length}#{entry.certificateNumbers.join(
                                                    ', '
                                                )}{/if}</td
                                        >{/if}
                                    <td title="Shares">{entry.shares || '—'}</td>
                                {/if}
                            </tr>
                        {/each}
                    </tbody>
                </table>
            {:else}<p class="empty">
                    {company.kind === NationalCompanyKind
                        ? 'Owned by the state; no shares.'
                        : 'No issued shares.'}
                </p>{/if}
        </section>
        {#if !vertical || privates.length || personalPrivates.length || investmentCompanies.length}
            <section aria-label="Company assets">
                <section aria-label="Private companies and powers">
                    {#if !vertical || privates.length}
                        <h3>{companyPowers?.heading ?? 'Privates & powers'}</h3>
                        {#each privates as item (item.id)}
                            {@render privateCard(item)}
                        {:else}<p class="empty">None</p>{/each}
                    {/if}
                    {#if personalPrivates.length && control}
                        {#if !vertical || privates.length}<hr />{/if}
                        <h3>Purchasable privates</h3>
                        {#each personalPrivates as item (item.id)}
                            {@render privateCard(
                                item,
                                item.maximumPrice === undefined
                                    ? 'No maximum'
                                    : `${money(item.maximumPrice)}`
                            )}
                        {/each}
                    {/if}
                </section>
                {#if investmentCompanies.length}
                    <h3 class="section-heading">Investments</h3>
                    {#each investmentCompanies as id (id)}
                        {@const shares = sharesOwned(gameState, id, owner)}
                        <p class="investment" title={session.companyFullName(id)}>
                            {session.companyInitials(id)}<strong
                                >{shares}
                                {shares === 1 ? 'share' : 'shares'}</strong
                            >
                        </p>{/each}
                {/if}
            </section>
        {/if}
    </div>
</article>
{#if trades && shownTradeOpening}
    <!-- One popover per opening: one hidden by Escape stays hidden until its close is reported. -->
    {#key shownTradeOpening.number}
        <CompanyTradePopover
            {session}
            companyId={company.id}
            {trades}
            anchor={shownTradeOpening.anchor}
            pointerY={shownTradeOpening.pointerY}
            onclose={() => (tradeOpening = undefined)}
        />
    {/key}
{/if}

{#snippet token()}
    {#if tokenBadges.length}<span class="badged-token"
            ><CompanyToken
                appearance={session.mapView.stations[company.id]}
                size={vertical ? 32 : 36}
            />{#each tokenBadges as badge, index (badge.description)}<img
                    class="token-badge"
                    style:right={`${index * 12 - 4}px`}
                    src={badge.imageUrl}
                    alt={badge.description}
                    title={badge.description}
                />{/each}</span
        >{:else}<CompanyToken
            appearance={session.mapView.stations[company.id]}
            size={vertical ? 32 : 36}
        />{/if}
{/snippet}

{#snippet name()}
    <h2 title={session.companyFullName(company.id)}>
        {session.companyName(company.id)}
    </h2>
{/snippet}

{#snippet markList(list: readonly CompanyMark[])}
    {#each list as mark (mark.label)}{#if mark.imageUrl}<img
                class="company-mark-image"
                src={mark.imageUrl}
                alt={mark.description}
                title={mark.description}
            />{:else}<span
                class="company-mark"
                title={mark.description}
                aria-label={mark.description}>{mark.label}</span
            >{/if}{/each}
{/snippet}

{#snippet prices()}
    <div class="prices">
        {@render cashValue()}
        {#if pricePresentation.showPar && parPrice !== undefined}<div>
                <span>Par</span><strong>{parPrice}</strong>
            </div>{/if}
        {@render marketValue()}
        {#if session.loans.rules && company.kind !== 'private' && company.started}<div>
                <span>{session.presentation.loanTerms?.name ?? 'Loans'}</span><strong
                    >{session.loans.held(company.id)}</strong
                >
            </div>{/if}
        {#each titleFacts.filter((fact) => !fact.below) as fact (fact.label)}<div>
                <span>{fact.label}</span><strong>{fact.value}</strong>
            </div>{/each}
        {#if !vertical}
            <div>
                <span>Last run</span>
                {#if company.lastRunRevenue === undefined}<strong>—</strong>
                {:else if lastRun && onPreviewMap}
                    <button
                        class="last-run"
                        class:withheld={lastRun.withheld}
                        disabled={session.busy || session.updatingVisibleState}
                        aria-label={`View ${session.companyName(company.id)}'s last run for ${money(company.lastRunRevenue)}${lastRun.withheld ? ', withheld' : ''}`}
                        onclick={() => onPreviewMap?.(lastRun!.run)}
                        >{money(company.lastRunRevenue)}</button
                    >
                {:else}<strong class:withheld={lastRun?.withheld}
                        >{money(company.lastRunRevenue)}</strong
                    >{/if}
            </div>
        {/if}
    </div>
{/snippet}

{#snippet marketValue()}
    {#if marketPrice !== undefined}<div
            class="market-value"
            class:market-zone-tint={valueMark}
            style={valueMark?.style}
            title={valueMark?.title}
        >
            <span>{pricePresentation.label}</span><strong>{marketPrice}</strong>
        </div>{/if}
{/snippet}

{#snippet cashValue()}
    <div class="cash-value">
        <span>Cash</span><strong
            >{cash === undefined ? '—' : cash === 'unlimited' ? '$∞' : `${money(cash)}`}</strong
        >
    </div>
{/snippet}

{#snippet privateCard(item: (typeof session.privates.companies)[number], purchasePrice?: string)}
    <article class="private" data-private-description-row>
        <div class="private-heading">
            <div class="private-name">
                <PrivateDescription
                    {money}
                    phaseColors={session.presentation.phaseColors}
                    tokens={session.privateCardTokens[item.id]}
                    imageUrl={session.publishedCardImage(item.id)}
                    plate={session.publishedCardPlate(item.id)}
                    shortName={session.companyName(item.id)}
                    fullName={session.companyFullName(item.id)}
                    description={item.description}
                    income={item.closed ? undefined : item.revenue}
                />{#each session.privateActions.powersFor(item.id) as power, index (index)}<span
                        class="private-power"
                        ><PrivateTrackPowerButton
                            {session}
                            {power}
                            label={session.privateActions.powersFor(item.id).length > 1 &&
                            'label' in power
                                ? power.label
                                : undefined}
                        /></span
                    >{/each}
            </div>
            <span
                >{purchasePrice ??
                    (item.closed
                        ? 'Closed'
                        : companyPowers
                          ? ''
                          : (session.presentation.privateStatus?.(gameState, item.id) ??
                            `${money(item.revenue)} / OR`))}</span
            >
        </div>
        {#if privatePowerUsed(gameState, item.id)}<span class="status">One-time power used</span
            >{/if}
    </article>
{/snippet}

<style>
    .private-power {
        margin-left: 6px;
        white-space: nowrap;
    }
    .company-detail.unavailable {
        background: var(--rail-surface, #f1f1ef);
        border-color: var(--rail-border, #d0d0cd);
    }
    .company-detail.unavailable header {
        background: var(--rail-surface-raised, #dededb);
    }
    .company-detail.unavailable .identity > div,
    .company-detail.unavailable .header-summary,
    .company-detail.unavailable .financial-summary,
    .company-detail.unavailable .detail-columns {
        opacity: var(--rail-phase-opacity, 0.5);
        filter: var(--rail-phase-filter, grayscale(1));
    }
    .company-detail.vertical {
        width: 200px;
        margin: 0;
        border-radius: 7px;
    }
    .vertical header {
        align-items: flex-start;
        gap: 5px;
    }
    .vertical .identity {
        flex: 1;
        min-width: 0;
        align-items: flex-start;
        gap: 7px;
    }
    /*
     * With no costs under them the station tokens are one line tall, so the header becomes a
     * grid: the name beside the tokens, and the train list below both, across the card.
     */
    .trains-under-stations header {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 0 7px;
    }
    .trains-under-stations .identity,
    .trains-under-stations .identity > div {
        display: contents;
    }
    .trains-under-stations .identity > :global(svg),
    .trains-under-stations .identity > .badged-token,
    .trains-under-stations .token-column {
        grid-row: 1 / span 3;
    }
    .trains-under-stations h2 {
        grid-column: 2;
        min-height: 20px;
    }
    .trains-under-stations .header-summary {
        grid-column: 3;
        grid-row: 1;
    }
    .trains-under-stations .train-roster,
    .trains-under-stations .subtitle {
        grid-column: 2 / span 2;
    }
    .trains-under-stations.unavailable h2,
    .trains-under-stations.unavailable .train-roster,
    .trains-under-stations.unavailable .subtitle {
        opacity: var(--rail-phase-opacity, 0.5);
        filter: var(--rail-phase-filter, grayscale(1));
    }
    .identity > :global(svg) {
        flex-shrink: 0;
    }
    .badged-token {
        position: relative;
        display: inline-flex;
        flex-shrink: 0;
    }
    .badged-token > :global(svg) {
        display: block;
    }
    .token-badge {
        position: absolute;
        bottom: -4px;
        width: 17px;
        height: 17px;
    }
    .vertical h2 {
        white-space: normal;
        font-size: 13px;
    }
    .vertical .header-summary {
        padding-left: 0;
    }
    .tokens-below-name header {
        flex-wrap: wrap;
        row-gap: 4px;
    }
    .tokens-below-name .header-summary {
        flex-basis: 100%;
        padding-left: 39px;
    }
    .vertical .detail-columns {
        grid-template-columns: minmax(0, 1fr);
        min-width: 0;
        max-height: none;
        contain: none;
        overflow: visible;
    }
    .company-detail.vertical .detail-columns > section {
        padding: 7px 10px;
    }
    .company-detail.vertical .detail-columns > section + section {
        border-left: 0;
        border-top: 1px solid var(--rail-border, #e3d9cd);
    }
    .financial-summary {
        padding: 0;
        border-top: 1px solid #ffffff0a;
        border-bottom: 1px solid var(--rail-border, #e3d9cd);
        background: color-mix(in srgb, #ffffff 4%, transparent);
    }
    .financial-summary .prices {
        gap: 0;
    }
    .fact-notes {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 2px 14px;
        margin: 0;
        align-items: center;
        padding: 4px 10px;
        border-top: 1px solid #ffffff0a;
        font-size: 11px;
        line-height: 14px;
        color: var(--rail-muted, #887664);
    }
    .fact-notes strong {
        color: var(--rail-text, #514536);
        font-weight: 600;
    }
    .financial-summary .prices div {
        position: relative;
        flex: 1;
        text-align: center;
        padding: 7px 10px;
    }
    .vertical .financial-summary .prices div {
        padding-inline: 4px;
    }
    .financial-summary .prices .market-value {
        background: #1b3d4580;
    }
    .financial-summary .prices .market-value.market-zone-tint {
        background: var(--market-tint);
        color: var(--market-tint-ink);
    }
    .financial-summary .prices .market-value.market-zone-tint span {
        color: inherit;
        opacity: 0.75;
    }
    .financial-summary .prices .cash-value {
        background: var(--rail-surface-inset, #1b232d);
    }
    .financial-summary .prices div + div::before {
        content: '';
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        height: 12px;
        border-left: 1px solid var(--rail-border, #e3d9cd);
    }
    .vertical tr > th,
    .vertical tr > td {
        padding-top: 0;
        padding-bottom: 0;
        line-height: 17px;
    }
    .vertical tr.investor-owner:has(+ .pool-divider) > th,
    .vertical tr.investor-owner:has(+ .pool-divider) > td {
        border-bottom: 6px solid transparent;
    }
    td.purchase-cell {
        padding: 0;
    }
    .vertical tr.pool-divider > th,
    .vertical tr.pool-divider > td {
        padding-top: 6px;
    }
    .company-detail {
        width: fit-content;
        max-width: 100%;
        border: 1px solid var(--rail-border, #d2c5b7);
        border-radius: 10px;
        background: var(--rail-surface, #faf7f1);
        color: var(--rail-text, #514538);
        margin: 3px 0 8px;
        box-shadow: 0 3px 10px var(--rail-shadow, #59432c08);
        overflow: hidden;
    }
    header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 5px 10px;
        border-bottom: 1px solid var(--rail-border, #e3d9cd);
        background: var(--rail-surface-raised, #e5dccf);
    }
    .identity {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
    }
    h2 {
        margin: 0;
        font-size: 15px;
        font-weight: 650;
        line-height: 1.2;
        white-space: nowrap;
    }
    .company-mark-image {
        width: 24px;
        height: 24px;
        cursor: help;
    }
    /* The marks follow the name's last word, also when the name wraps. */
    .name-line {
        font-size: 15px;
        line-height: 1.2;
    }
    .name-line h2 {
        display: inline;
    }
    .name-line .compact-marks {
        margin-left: 6px;
        vertical-align: middle;
    }
    .compact-marks {
        display: inline-flex;
        flex-shrink: 0;
        align-items: center;
        gap: 2px;
    }
    .compact-marks .company-mark-image {
        width: 13px;
        height: 13px;
    }
    /* On the narrow card the marks sit under the company's token, no wider than it. */
    .token-column {
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
        align-items: center;
        gap: 4px;
    }
    .token-column .compact-marks {
        flex-wrap: wrap;
        justify-content: center;
        max-width: 34px;
    }
    .token-column .company-mark-image {
        width: 16px;
        height: 16px;
    }
    .company-mark {
        padding: 0 5px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 3px;
        background: #111418;
        color: #e8edf2;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.05em;
        line-height: 15px;
        text-transform: uppercase;
        cursor: help;
    }
    .origin {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 5px;
        margin: 0;
        padding: 3px 10px;
        border-bottom: 1px solid var(--rail-border, #e3d9cd);
        color: var(--rail-muted, #887664);
        font-size: 11px;
    }
    .connection {
        width: 100%;
        border: 0;
        border-bottom: 1px solid var(--rail-border, #e3d9cd);
        background: none;
        font-family: inherit;
        cursor: pointer;
    }
    .connection span {
        text-decoration: underline dotted;
        text-decoration-thickness: 1px;
        text-underline-offset: 2px;
    }
    .connection:hover span {
        color: var(--rail-text, #514536);
        text-decoration-style: solid;
    }
    .origin-company {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: var(--rail-text, #514536);
    }
    .origin strong {
        font-weight: 650;
    }
    .subtitle {
        margin: 2px 0 0;
        color: var(--rail-muted, #887664);
        font-size: 11px;
        text-transform: capitalize;
    }
    .header-summary {
        display: flex;
        align-items: center;
        flex-shrink: 0;
        gap: 10px;
        margin-left: auto;
        padding-left: 6px;
    }
    .prices {
        display: flex;
        gap: 16px;
    }
    .prices div {
        display: flex;
        flex-direction: column;
        gap: 0;
        text-align: right;
    }
    .prices span {
        line-height: 12px;
        font-size: 10px;
        color: var(--rail-muted, #887664);
    }
    .last-run {
        border: 0;
        border-radius: 4px;
        padding: 0 4px;
        margin: 0 auto;
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: 14px;
        font-weight: 700;
        line-height: 16px;
        cursor: pointer;
        font-variant-numeric: tabular-nums;
    }
    .last-run:hover:enabled {
        background: var(--rail-hover, #ffffff66);
    }
    .last-run:focus-visible {
        outline: 2px solid var(--rail-focus, #9e7752);
        outline-offset: 2px;
    }
    .last-run:disabled {
        cursor: default;
    }
    .withheld {
        color: var(--rail-negative, #b33a32);
    }
    .prices strong {
        line-height: 16px;
        font-size: 14px;
        font-variant-numeric: tabular-nums;
    }
    .detail-columns {
        display: grid;
        grid-template-columns: 175px minmax(0, 1fr);
        contain: inline-size;
        min-width: 390px;
        max-height: 320px;
        overflow: auto;
    }
    .company-detail.wide-fill {
        width: 100%;
        margin: 0;
        container-type: inline-size;
    }
    .wide-fill .identity {
        flex: 1 1 auto;
        min-width: 0;
    }
    .wide-fill h2 {
        white-space: normal;
    }
    .vertical .identity > div,
    .wide-fill .identity > div {
        min-width: 0;
    }
    .vertical h2,
    .wide-fill h2 {
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .wide-fill .financial-summary .prices {
        flex-wrap: wrap;
    }
    .wide-fill .financial-summary .prices div {
        padding-inline: 6px;
    }
    .wide-fill .ownership-heading {
        flex-wrap: wrap;
        column-gap: 8px;
    }
    .wide-fill .share-status {
        white-space: nowrap;
    }
    .wide-fill .detail-columns {
        min-width: 0;
        max-height: none;
        overflow: visible;
    }
    @container (width < 380px) {
        .wide-fill .detail-columns {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
    }
    .detail-columns > section {
        min-width: 0;
        padding: 8px 10px;
    }
    .detail-columns > section + section {
        border-left: 1px solid var(--rail-border, #e3d9cd);
    }
    h3 {
        margin: 0 0 7px;
        font-size: 10px;
        font-weight: 650;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--rail-muted, #887664);
    }
    .ownership-heading {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 6px;
    }
    .share-status {
        font-size: 10px;
        font-weight: 650;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #f1e6c8;
    }
    .share-status.unfloated {
        color: #e2a84f;
    }
    .heading-end {
        display: flex;
        align-items: baseline;
        gap: 8px;
    }
    .company-detail.tradable {
        cursor: pointer;
    }
    .company-detail.tradable:hover,
    .company-detail.trading {
        border-color: var(--rail-focus, #a87948);
    }
    .trade-opener {
        border: 0;
        padding: 0;
        background: transparent;
        color: var(--rail-focus, #a87948);
        font: inherit;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
    }
    .trade-opener:focus-visible {
        outline: 2px solid var(--rail-focus, #a87948);
        outline-offset: 2px;
    }
    .ownership-heading h3 {
        margin-bottom: 0;
    }
    tr.sold {
        color: var(--rail-negative, #b33a32);
    }
    tr.player-tinted-row > th,
    tr.player-tinted-row > td {
        background: color-mix(in srgb, var(--player-color) 15%, var(--rail-surface, #222c37));
    }
    .president > th,
    .president > td {
        font-weight: 700;
    }
    .pool-divider > th,
    .pool-divider > td {
        border-top: 1px solid var(--rail-border, #e3d9cd);
        padding-top: 6px;
    }
    tr:has(+ .pool-divider) > th,
    tr:has(+ .pool-divider) > td {
        border-bottom: 6px solid transparent;
        background-clip: padding-box;
    }
    table {
        width: calc(100% + 20px);
        margin-inline: -10px;
        border-collapse: separate;
        border-spacing: 0;
        font-size: 12px;
    }
    th,
    td {
        padding: 2px 0;
        text-align: right;
        font-variant-numeric: tabular-nums;
    }
    tr > :first-child {
        padding-left: 10px;
    }
    tr > :last-child {
        padding-right: 10px;
    }
    th:first-child {
        text-align: left;
    }
    th {
        font-weight: 500;
    }
    td {
        padding-left: 12px;
    }
    /* Dimmed from the row's own colour so sold and tinted rows keep their tone. */
    td.certificate-numbers {
        color: color-mix(in srgb, currentColor 65%, transparent);
    }
    .empty {
        margin: 0;
        color: var(--rail-muted, #887664);
        font-size: 12px;
    }
    .train-roster {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 3px;
        min-height: 16px;
    }
    .train-required {
        color: var(--rail-negative, #b33a32);
    }
    .section-heading {
        margin-top: 12px;
    }
    hr {
        border: 0;
        border-top: 1px solid var(--rail-border, #e3d9cd);
        margin: 8px 0;
    }
    .investment {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin: 6px 0;
        font-size: 12px;
    }
    .private {
        cursor: pointer;
    }
    .private + .private {
        margin-top: 4px;
    }
    .private-heading {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        font-size: 12px;
    }
    .private-name {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 2px 0;
        font-weight: 400;
    }
    .private-heading > span {
        white-space: nowrap;
        color: var(--rail-muted, #887664);
        font-size: 11px;
    }
    .status {
        font-size: 10px;
        color: var(--rail-text, #926b3f);
    }
</style>
