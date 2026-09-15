<script lang="ts">
    import { flip } from 'svelte/animate'
    import { prefersReducedMotion } from 'svelte/motion'
    import { companyFocusLocations } from '../maps/companyFocusLocations.js'
    import { certificatesOwnedBy, controllingOwner, getCompany, type Owner, type ValuationRules } from '@tabletop/18xx'
    import { auctionLotDetails } from '../auctions/auctionLotDetails.js'
    import { assertExists } from '@tabletop/common'
    import type { NumberedShareNames } from './companyPresentation.js'
    import PrivateDescription from '../privates/PrivateDescription.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import PresidentBadge from '../finance/PresidentBadge.svelte'
    import { ownerPortfolio } from '../finance/ownerPortfolio.js'
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'

    let {
        session,
        valuationRules,
        auctionLotDescription,
        numberedShareNames = {},
        numberedShareLocation,
        onFocusLocation,
        mapFocusExcludedCompanyIds = [],
        onFocusCompany,
        portfolioCompanyIds = []
    }: {
        session: FinanceExampleSession
        valuationRules: ValuationRules
        auctionLotDescription?: (id: string) => string
        numberedShareNames?: NumberedShareNames
        numberedShareLocation?: (companyId: string, number: number) => string | undefined
        onFocusLocation: (locationId: string) => void
        mapFocusExcludedCompanyIds?: readonly string[]
        onFocusCompany: (companyId: string) => void
        portfolioCompanyIds?: readonly string[]
    } = $props()
    const stockRoundActive = $derived(session.financialState.machineState === 'StockRound')
    const passOrderPositions = $derived(session.passing === 'pass-order')
    const players = $derived([
        ...session.financialState.turnManager.turnOrder.map((playerId) => ({
            id: `player:${playerId}`,
            owner: { kind: 'player', playerId } as const,
            controller: undefined,
            description: undefined,
            playerId,
            name: session.getPlayerName(playerId),
            liquidity: session.playerLiquidity(playerId),
            certs: session.playerCertificates(playerId),
            ...ownerPortfolio(session.financialState, { kind: 'player', playerId }, valuationRules)
        })),
        ...portfolioCompanyIds.map((companyId) => {
            const controller = controllingOwner(session.financialState, companyId)
            return {
                id: `company:${companyId}`,
                owner: { kind: 'company', companyId } as const,
                playerId: undefined,
                description: session.privateCompanies.find((company) => company.id === companyId)
                    ?.description,
                name: getCompany(session.financialState, companyId).name,
                controller: controller ? session.getPlayerName(controller.playerId) : undefined,
                liquidity: undefined,
                certs: undefined,
                ...ownerPortfolio(
                    session.financialState,
                    { kind: 'company', companyId },
                    valuationRules
                )
            }
        })
    ])
    const auctionActive = $derived(
        (session.offerAuction !== undefined && !session.offerAuction.auction.completed) ||
        (session.auction !== undefined && !session.auction.auction.completed)
    )
    const auctionPiles = $derived(new Map(
        session.offerAuction && !session.offerAuction.auction.completed
            ? session.offerAuction.auction.piles.map((pile) => [pile.playerId, auctionLotDetails(session, pile.lotIds)])
            : []
    ))
    const focusableCompanyIds = $derived(new Set(session.financialState.companies
        .filter((company) => !mapFocusExcludedCompanyIds.includes(company.id) && companyFocusLocations(session.stationDisplayState, company.id).length > 0)
        .map((company) => company.id)))
    function numberedShares(owner: Owner, companyId: string) {
        const names = numberedShareNames[companyId]
        if (!names) return []
        return certificatesOwnedBy(session.financialState, owner)
            .filter((certificate) => certificate.kind === 'share')
            .filter((certificate) => certificate.companyId === companyId)
            .map((certificate) => {
                assertExists(certificate.number, 'Numbered shares require a number')
                const name = names[certificate.number]
                assertExists(name, 'Numbered share requires a title-supplied name')
                return { number: certificate.number, name }
            })
            .sort((a, b) => a.number - b.number)
    }
    const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
    const percent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
</script>

<div class="players" aria-label="Players">
    {#each players as player, index (player.id)}
        <article
            animate:flip={{ duration: prefersReducedMotion.current ? 0 : 180 }}
            aria-label={`${player.name} portfolio`}
            data-player-id={player.playerId}
            class:active={player.playerId !== undefined &&
                session.financialState.activePlayerIds.includes(player.playerId)}
        >
            <header
                data-private-description-row={player.description ? true : undefined}
                class:has-description={!!player.description}
            >
                <h3>
                    {#if player.playerId}<span
                            class="player-color"
                            style:background={session.colors.getPlayerBgColorValue(player.playerId)}
                        ></span>{/if}{#if player.description}<PrivateDescription
                            name={player.name}
                            description={player.description}
                        />{:else}{player.name}{/if}
                </h3>
                {#if player.controller}<span class="controller"
                        >Controlled by {player.controller}</span
                    >{/if}
                {#if player.playerId && passOrderPositions}
                    {@const position = stockRoundActive ? session.playerPriorityOrder.indexOf(player.playerId) + 1 : index + 1}
                    {#if !stockRoundActive || session.financialState.stockRound.passedPlayerIds.includes(player.playerId)}
                        <span class="turn-position" aria-label={`${stockRoundActive ? 'Next turn' : 'Turn'} position ${position}`}>
                            {#if stockRoundActive}<small>Next</small>{/if}<b>{position}</b>
                        </span>
                    {/if}
                {:else if player.playerId === session.playerPriorityOrder[0]}
                    <span class="priority" title="First in priority order">Priority deal</span>
                {/if}
            </header>
            <div class="stats">
                <dl>
                    <dt>Cash</dt>
                    <dd>${money.format(player.cash)}</dd>
                </dl>
                {#if player.liquidity !== undefined}<span class="stat-divider" aria-hidden="true"
                    ></span>
                    <dl
                        title="Cash plus available share-sale proceeds at current prices and stock-sale limits. Excludes negotiated private sales and company cash."
                    >
                        <dt>Liquidity</dt>
                        <dd>${money.format(player.liquidity)}</dd>
                    </dl>{/if}
                <span class="stat-divider" aria-hidden="true"></span>
                <dl>
                    <dt>Shares</dt>
                    <dd>{player.shares}</dd>
                </dl>
                {#if player.certs}<span class="stat-divider" aria-hidden="true"></span>
                    <dl title="Certificates counted toward the title’s certificate limit">
                        <dt>Certs</dt>
                        <dd>{player.certs.count}/{player.certs.limit}</dd>
                    </dl>{/if}
                <span class="stat-divider" aria-hidden="true"></span>
                <dl>
                    <dt>Net worth</dt>
                    <dd>${money.format(player.netWorth)}</dd>
                </dl>
            </div>
            {#if player.playerId && auctionPiles.has(player.playerId)}
                <section class="auction-lot" aria-label={`${player.name} auction lot`}>
                    <h4>Auction lot</h4>
                    <table>
                        <tbody>
                            {#each auctionPiles.get(player.playerId) ?? [] as lot (lot.id)}
                                {@const description = auctionLotDescription?.(lot.id) ?? lot.company?.description}
                                <tr data-private-description-row>
                                    <th scope="row">
                                        {#if description}<PrivateDescription name={lot.name} {description} value={lot.price} income={lot.company?.privateRevenue} />{:else}{lot.name}{/if}
                                    </th>
                                    <td class="amount">${money.format(lot.price)}</td>
                                </tr>
                            {:else}<tr><td class="empty">None</td></tr>{/each}
                        </tbody>
                    </table>
                </section>
            {/if}
            {#if !auctionActive || player.ownership.length}
            <section>
                <h4>Ownership</h4>
                {#if player.ownership.length}
                    <table class="ownership" aria-label={`${player.name} company ownership`}>
                        <tbody>
                            {#each player.ownership.toSorted((a, b) => Number(!!numberedShareNames[a.company.id]) - Number(!!numberedShareNames[b.company.id])) as entry (entry.company.id)}
                                <tr
                                    class:has-numbered-shares={!!numberedShareNames[entry.company.id]}
                                    class:president={entry.president}
                                    title={entry.president ? 'President' : undefined}
                                >
                                    <td class="token"
                                        ><button class="company-focus" aria-label={`Show ${entry.company.name} stations`} disabled={!focusableCompanyIds.has(entry.company.id)} onclick={() => onFocusCompany(entry.company.id)}><CompanyToken
                                            appearance={session.mapView.stations[entry.company.id]}
                                            size={22}
                                        /></button></td
                                    >
                                    <th scope="row"
                                        ><button class="company-focus" disabled={!focusableCompanyIds.has(entry.company.id)} onclick={() => onFocusCompany(entry.company.id)}>{entry.company.name}</button>{#if entry.president}<PresidentBadge
                                            />{/if}</th
                                    >
                                    <td class="amount">{percent.format(entry.percentage)}%</td>
                                </tr>
                                {#each numberedShares(player.owner, entry.company.id) as share (share.number)}
                                    {@const locationId = numberedShareLocation?.(entry.company.id, share.number)}
                                    <tr class="numbered-share">
                                        <td></td>
                                        <td colspan="2">
                                            {#if locationId}<button class="company-focus" onclick={() => onFocusLocation(locationId)}><span class="share-number">{share.number}</span> - {share.name}</button>{:else}<span class="share-number">{share.number}</span> - {share.name}{/if}
                                        </td>
                                    </tr>
                                {/each}
                            {/each}
                        </tbody>
                    </table>
                {:else}<p class="empty">None</p>{/if}
            </section>
            {/if}
            {#if player.privates.length}<section class="privates">
                    <div class="private-head">
                        <h4>Privates</h4>
                        <span title="Income per operating round">Income</span><span>Value</span>
                    </div>
                    <table aria-label={`${player.name} private companies`}>
                        <tbody>
                            {#each player.privates as entry (entry.company.id)}
                                <tr data-private-description-row>
                                    <th scope="row"
                                        ><PrivateDescription
                                            name={entry.company.name}
                                            value={entry.value}
                                            income={entry.income}
                                            description={session.privateCompanies.find(
                                                (company) => company.id === entry.company.id
                                            )?.description ?? ''}
                                        /></th
                                    >
                                    <td class="amount">${money.format(entry.income)}</td>
                                    <td class="amount">${money.format(entry.value)}</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </section>{/if}
        </article>
    {/each}
</div>

<style>
    .players {
        display: grid;
        gap: 10px;
        padding: 0 2px 8px;
    }
    article {
        min-width: 0;
        border: 1px solid #d2c5b7;
        border-radius: 8px;
        background: #faf7f1;
        color: #514538;
        overflow: hidden;
    }
    article.active {
        border-color: #796047;
    }
    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 9px 10px 9px;
        border-bottom: 1px solid #e3d9cd;
    }
    header.has-description {
        cursor: pointer;
    }
    h3 {
        display: flex;
        align-items: center;
        gap: 7px;
        margin: 0;
        font-size: 15px;
        font-weight: 650;
    }
    .player-color {
        width: 9px;
        height: 9px;
        border-radius: 50%;
    }
    .controller {
        color: #887664;
        font-size: 10px;
    }
    .turn-position { display: flex; align-items: baseline; gap: 5px; margin-left: auto; color: #695543; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .turn-position small { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; }
    .turn-position b { font-size: 20px; font-weight: 650; line-height: 1; }
    .priority {
        border: 1px solid #c8b08b;
        border-radius: 4px;
        background: #efe4cf;
        color: #796047;
        padding: 2px 5px;
        font-size: 10px;
        white-space: nowrap;
    }
    .stats {
        display: flex;
        margin: 0;
        padding: 6px 10px 8px;
        border-bottom: 1px solid #e3d9cd;
    }
    .stats > dl {
        margin: 0;
        text-align: center;
        white-space: nowrap;
    }
    .stat-divider {
        display: flex;
        flex: 1;
        min-width: 8px;
        align-items: center;
        justify-content: center;
    }
    .stat-divider::before {
        content: '';
        height: 12px;
        border-left: 1px solid #e3d9cd;
    }
    dt {
        line-height: 12px;
        font-size: 10px;
        color: #887664;
    }
    dd {
        margin: 0;
        line-height: 16px;
        font-size: 14px;
        font-weight: 650;
        font-variant-numeric: tabular-nums;
    }
    section {
        padding: 8px 10px;
    }
    h4 {
        margin: 0 0 4px;
        font-size: 10px;
        font-weight: 650;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: #887664;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
    }
    th {
        text-align: left;
        font-weight: 500;
    }
    th,
    td {
        padding: 3px 0;
        vertical-align: middle;
    }
    .company-focus {
        padding: 0;
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
    }
    .company-focus:disabled { cursor: default; }
    .company-focus:focus-visible { outline: 1px solid #796047; outline-offset: 2px; border-radius: 2px; }
    .token .company-focus { display: block; }
    .token {
        width: 28px;
    }
    .token :global(svg) {
        display: block;
    }
    .amount {
        padding-left: 6px;
        text-align: right;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
    }
    .has-numbered-shares > th,
    .has-numbered-shares > td {
        padding-bottom: 0;
    }
    .numbered-share td {
        padding-top: 0;
        padding-bottom: 0;
        line-height: 1.2;
        font-size: 12px;
        color: #786550;
    }
    .share-number { font-variant-numeric: tabular-nums; }
    .ownership .amount {
        width: 42px;
    }
    .president th,
    .president .amount {
        font-weight: 700;
    }
    .auction-lot + section,
    .privates {
        border-top: 1px solid #e3d9cd;
    }
    .private-head {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 46px 52px;
        gap: 0;
        align-items: baseline;
    }
    .private-head span {
        text-align: right;
        color: #887664;
        font-size: 10px;
    }
    .privates th,
    .privates td {
        padding-top: 1px;
        padding-bottom: 1px;
        line-height: 1.3;
    }
    .privates tr {
        cursor: pointer;
    }
    .privates td {
        width: 46px;
    }
    .privates td:last-child {
        width: 52px;
    }
    .empty {
        margin: 0;
        color: #938371;
        font-size: 12px;
    }
</style>
