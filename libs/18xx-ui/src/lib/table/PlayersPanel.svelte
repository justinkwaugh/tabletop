<script lang="ts">
    import { controllingOwner, getCompany, type ValuationRules } from '@tabletop/18xx'
    import PrivateDescription from '../privates/PrivateDescription.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import PresidentBadge from '../finance/PresidentBadge.svelte'
    import { ownerPortfolio } from '../finance/ownerPortfolio.js'
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'

    let {
        session,
        valuationRules,
        portfolioCompanyIds = []
    }: {
        session: FinanceExampleSession
        valuationRules: ValuationRules
        portfolioCompanyIds?: readonly string[]
    } = $props()
    const players = $derived([
        ...session.playerPriorityOrder.map((playerId) => ({
            id: `player:${playerId}`,
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
    const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
    const percent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
</script>

<div class="players" aria-label="Players">
    {#each players as player, index (player.id)}
        <article
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
                {#if index === 0}<span class="priority" title="First in priority order"
                        >Priority deal</span
                    >{/if}
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
            <section>
                <h4>Ownership</h4>
                {#if player.ownership.length}
                    <table class="ownership" aria-label={`${player.name} company ownership`}>
                        <tbody>
                            {#each player.ownership as entry (entry.company.id)}
                                <tr
                                    class:president={entry.president}
                                    title={entry.president ? 'President' : undefined}
                                >
                                    <td class="token"
                                        ><CompanyToken
                                            appearance={session.mapView.stations[entry.company.id]}
                                            size={22}
                                        /></td
                                    >
                                    <th scope="row"
                                        >{entry.company.name}{#if entry.president}<PresidentBadge
                                            />{/if}</th
                                    >
                                    <td class="amount">{percent.format(entry.percentage)}%</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                {:else}<p class="empty">None</p>{/if}
            </section>
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
        font-size: 10px;
        color: #887664;
    }
    dd {
        margin: 1px 0 0;
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
    .ownership .amount {
        width: 42px;
    }
    .president th,
    .president .amount {
        font-weight: 700;
    }
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
