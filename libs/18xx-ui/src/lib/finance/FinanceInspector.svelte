<script lang="ts">
    import {
        getCompany,
        cashOwnedBy,
        getTreasury,
        privateOwner,
        controllingOwner
    } from '@tabletop/18xx'
    import { assertExists, type Player, type PlayerState } from '@tabletop/common'
    import type {
        Certificate,
        Owner,
        FinancialState,
        Station,
        StationReservation
    } from '@tabletop/18xx'
    import type { Portfolio as PortfolioModel } from '@tabletop/18xx'
    import type { Snippet } from 'svelte'
    import Portfolio from './Portfolio.svelte'
    let {
        gameState,
        players,
        playerStates,
        certificateDetail,
        certificateWeight,
        stations = [],
        stationReservations = []
    }: {
        gameState: FinancialState
        players: readonly Player[]
        playerStates: readonly PlayerState[]
        certificateDetail?: Snippet<[Certificate]>
        certificateWeight?: (certificate: PortfolioModel[number]) => number
        stations?: readonly Station[]
        stationReservations?: readonly StationReservation[]
    } = $props()
    function playerName(playerId: string) {
        const player = players.find((player) => player.id === playerId)
        assertExists(player, 'Portfolio requires a known player')
        return player.name
    }
    function ownerName(owner: Owner) {
        switch (owner.kind) {
            case 'player':
                return playerName(owner.playerId)
            case 'company':
                return getCompany(gameState, owner.companyId).name
            case 'bank':
                return gameState.bank.name
        }
    }
</script>

<div class="finances">
    <section aria-label="Player portfolios">
        <h2>Players</h2>
        <div class="portfolios">
            {#each playerStates as player (player.playerId)}
                {@const owner = { kind: 'player', playerId: player.playerId } as const}
                <Portfolio
                    {gameState}
                    {owner}
                    name={playerName(player.playerId)}
                    cash={cashOwnedBy(gameState, owner)}
                    color={player.color}
                    {certificateDetail}
                    {certificateWeight}
                />
            {/each}
        </div>
    </section>
    <section aria-label="Company treasuries and control">
        <h2>Companies</h2>
        <div class="portfolios">
            {#each gameState.companies as company (company.id)}
                {@const controllingPlayer = controllingOwner(gameState, company.id)}
                {@const owner =
                    company.kind === 'private' ? privateOwner(gameState, company.id) : undefined}
                <div class="company" data-company-id={company.id}>
                    <Portfolio
                        {gameState}
                        owner={{ kind: 'company', companyId: company.id }}
                        name={company.name}
                        label="treasury"
                        cash={getTreasury(gameState, company.id).cash}
                        {certificateDetail}
                        {certificateWeight}
                    />
                    {#if company.closed}<p class="authority">Closed</p>
                    {:else if company.started !== undefined}
                        <p class="authority" data-company-lifecycle={company.id}>
                            {company.started ? 'Started' : 'Not started'} · {company.funded
                                ? 'Funded'
                                : 'Not funded'} · {company.floated ? 'Floated' : 'Not floated'} · {company.operated
                                ? 'Operated'
                                : 'Not operated'}
                        </p>
                    {/if}
                    {#each stationReservations.filter((reservation) => reservation.companyId === company.id) as reservation}
                        <p class="authority">Reserved home: {reservation.locationId}</p>
                    {/each}
                    {#each stations.filter((station) => station.companyId === company.id && station.status === 'placed') as station (station.id)}
                        {#if station.status === 'placed'}<p
                                class="authority"
                                data-station-id={station.id}
                            >
                                Station: {station.position.locationId}
                            </p>{/if}
                    {/each}
                    {#if company.kind === 'private'}
                        <p class="authority">Owner: {owner ? ownerName(owner) : 'None'}</p>
                    {:else}
                        <p class="authority">
                            President: {company.president ? ownerName(company.president) : 'None'}
                        </p>
                    {/if}
                    <p class="authority">
                        Controlling owner: {controllingPlayer
                            ? ownerName(controllingPlayer)
                            : 'None'}
                    </p>
                    {#if company.privateRevenue !== undefined}<p class="authority">
                            Private income: {company.privateRevenue} per operating round
                        </p>{/if}
                </div>
            {/each}
        </div>
    </section>
    <section aria-label="Bank cash and certificates">
        <h2>Bank</h2>
        <div class="portfolios">
            <Portfolio
                {gameState}
                owner={{ kind: 'bank' }}
                name={gameState.bank.name}
                label="certificates"
                cash={cashOwnedBy(gameState, { kind: 'bank' })}
                {certificateDetail}
                {certificateWeight}
            />
        </div>
    </section>
</div>

<style>
    .finances {
        color: #253b35;
        font:
            14px/1.45 ui-sans-serif,
            system-ui,
            sans-serif;
    }
    section + section {
        margin-top: 28px;
    }
    h2 {
        font-size: 17px;
        font-weight: 650;
        margin: 0 0 12px;
    }
    .portfolios {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 290px), 1fr));
        gap: 16px;
        align-items: start;
    }
    .company {
        min-width: 0;
    }
    .authority {
        margin: 8px 4px;
        font-size: 12px;
        color: #4d655c;
        overflow-wrap: anywhere;
    }
</style>
