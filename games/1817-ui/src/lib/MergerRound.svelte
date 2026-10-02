<script lang="ts">
    import { cashOwnedBy, companyMarketSpace, getCompany, trainsOwnedBy } from '@tabletop/18xx'
    import { CompanyToken, TrainBadge } from '@tabletop/18xx-ui'
    import {
        EighteenSeventeenMap,
        StationPrice,
        stationsOverLimit,
        treasuryShareIds
    } from '@tabletop/1817'
    import type { EighteenSeventeenSession } from './session.svelte.js'
    let { session }: { session: EighteenSeventeenSession } = $props()
    const money = $derived(session.presentation.money)
    const gameState = $derived(session.gameState)
    const valid = $derived(session.validActionTypes)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
    const round = $derived(session.mergerRound)
    const company = $derived(round && getCompany(gameState, round.companyId))
    const treasury = $derived(
        round ? Number(cashOwnedBy(gameState, { kind: 'company', companyId: round.companyId })) : 0
    )
    const stationsOwed = $derived(round?.conversion?.stationsOwed ?? 0)
    const stationCost = $derived(stationsOwed * StationPrice)
    const waitingFor = $derived(
        gameState.activePlayerIds.map((id) => session.getPlayerName(id)).join(', ')
    )
</script>

{#if round && company}
    <section aria-label="Merger round">
        <header>
            <CompanyToken appearance={session.mapView.stations[company.id]} size={24} />
            <strong>{company.name}</strong>
            <span
                >{company.shareCount} shares · {money(
                    companyMarketSpace(gameState.stockMarket, company.id).price
                )} · Treasury {money(treasury)}</span
            >
        </header>
        {#if gameState.machineState === 'MergerRound'}
            {#if valid.includes('PassMerger')}
                <div class="choices">
                    {#if valid.includes('ConvertCompany')}<button
                            disabled={busy}
                            onclick={() => session.convertCompany()}
                            >Convert to {company.shareCount === 2 ? 5 : 10} shares</button
                        >{/if}
                    {#each round.targets as target (target.companyId)}
                        <button
                            disabled={busy}
                            onclick={() => session.mergeCompanies(target.companyId)}
                            >Merge with {getCompany(gameState, target.companyId).name} ({money(
                                target.price
                            )})</button
                        >
                    {/each}
                    <button disabled={busy} onclick={() => session.passMerger()}>Pass</button>
                </div>
            {:else}
                <p>Waiting for {waitingFor} to convert, merge or pass.</p>
            {/if}
        {:else if gameState.machineState === 'TradingConvertedShares'}
            <p>
                {treasuryShareIds(gameState, company.id).length} treasury shares at {money(
                    round.conversion?.price ?? 0
                )}
            </p>
            {#if valid.includes('PassConvertedShares')}
                <div class="choices">
                    {#if round.purchase}<button
                            disabled={busy}
                            onclick={() => session.buyConvertedShare()}
                            >Buy a share ({money(round.purchase.price)})</button
                        >{/if}
                    <button disabled={busy} onclick={() => session.passConvertedShares()}
                        >Pass</button
                    >
                </div>
            {:else}
                <p>Waiting for {waitingFor} to buy or pass.</p>
            {/if}
        {:else if gameState.machineState === 'BorrowingAfterConversion'}
            <p>
                Loans {session.loans.loans(company.id)}/{session.loans.capacity(company.id)}
                {#if stationsOwed}· Needs {stationsOwed} more {stationsOwed === 1
                        ? 'station'
                        : 'stations'} ({money(stationCost)}){/if}
            </p>
            {#if valid.includes('FinishConversionLoans')}
                <div class="choices">
                    {#if valid.includes('TakeLoan')}<button
                            disabled={busy}
                            onclick={() => session.loans.take(company.id)}>Take a loan</button
                        >{/if}
                    <button disabled={busy} onclick={() => session.finishConversionLoans()}
                        >{!stationsOwed
                            ? 'Finish'
                            : treasury < stationCost
                              ? 'Finish and liquidate'
                              : `Buy ${stationsOwed === 1 ? 'station' : 'stations'}`}</button
                    >
                </div>
            {:else}
                <p>Waiting for {waitingFor} to borrow or finish.</p>
            {/if}
        {:else if gameState.machineState === 'ReducingStations'}
            <p>{stationsOverLimit(gameState, company.id)} stations over the limit</p>
            {#if valid.includes('RemoveStation')}
                <div class="choices">
                    {#each gameState.stations as station (station.id)}
                        {#if station.companyId === company.id && station.status === 'placed'}<button
                                disabled={busy}
                                onclick={() => session.removeStation(station.id)}
                                >Remove {EighteenSeventeenMap.location(station.position.locationId)
                                    .name ?? station.position.locationId}</button
                            >{/if}
                    {/each}
                </div>
            {:else}
                <p>Waiting for {waitingFor} to remove stations.</p>
            {/if}
        {:else if gameState.machineState === 'DiscardingMergedTrains'}
            <p>Over the train limit</p>
            {#if valid.includes('DiscardMergedTrain')}
                <div class="choices">
                    {#each trainsOwnedBy( gameState, { kind: 'company', companyId: company.id } ) as train (train.id)}
                        <button disabled={busy} onclick={() => session.discardMergedTrain(train.id)}
                            >Discard <TrainBadge
                                name={session.trainDepot.trainDefinition(train.definitionId).name}
                                color={session.presentation.trainColors[train.definitionId]}
                            /></button
                        >
                    {/each}
                </div>
            {:else}
                <p>Waiting for {waitingFor} to discard trains.</p>
            {/if}
        {/if}
    </section>
{/if}

<style>
    section {
        padding: 6px 0;
        font-size: 12px;
        color: var(--rail-text, #514536);
        text-align: center;
    }
    header {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
    }
    p {
        margin: 4px 0;
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
        margin-top: 4px;
    }
    button {
        padding: 5px 10px;
        font: inherit;
        color: inherit;
        cursor: pointer;
        background: var(--rail-surface, #fffdf8);
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 7px;
    }
    button:hover:not(:disabled) {
        background: var(--rail-surface-raised, #efe7db);
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
</style>
