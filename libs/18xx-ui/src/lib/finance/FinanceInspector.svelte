<script lang="ts">
    import {
        getCompany,
        cashOwnedBy,
        getTreasury,
        privateOwner,
        controllingOwner
    } from '@tabletop/18xx'
    import { assertExists, type Player, type PlayerState } from '@tabletop/common'
    import type { Certificate, Owner, FinancialState } from '@tabletop/18xx'
    import type { Snippet } from 'svelte'
    import Portfolio from './Portfolio.svelte'
    let {
        state,
        players,
        playerStates,
        certificateDetail
    }: {
        state: FinancialState
        players: readonly Player[]
        playerStates: readonly PlayerState[]
        certificateDetail?: Snippet<[Certificate]>
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
                return getCompany(state, owner.companyId).name
            case 'bank':
                return state.bank.name
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
                    {state}
                    {owner}
                    name={playerName(player.playerId)}
                    cash={cashOwnedBy(state, owner)}
                    color={player.color}
                    {certificateDetail}
                />
            {/each}
        </div>
    </section>
    <section aria-label="Company treasuries and control">
        <h2>Companies</h2>
        <div class="portfolios">
            {#each state.companies as company (company.id)}
                {@const controllingPlayer = controllingOwner(state, company.id)}
                {@const owner =
                    company.kind === 'private' ? privateOwner(state, company.id) : undefined}
                <div class="company" data-company-id={company.id}>
                    <Portfolio
                        {state}
                        owner={{ kind: 'company', companyId: company.id }}
                        name={company.name}
                        label="treasury"
                        cash={getTreasury(state, company.id).cash}
                        {certificateDetail}
                    />
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
                {state}
                owner={{ kind: 'bank' }}
                name={state.bank.name}
                label="certificates"
                cash={cashOwnedBy(state, { kind: 'bank' })}
                {certificateDetail}
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
