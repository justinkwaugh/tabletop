<script lang="ts">
    import { cashOwnedBy, companyMarketSpace, getCompany } from '@tabletop/18xx'
    import { CompanyToken, TrainBadge } from '@tabletop/18xx-ui'
    import { EighteenSeventeenMap } from '@tabletop/1817'
    import { plural } from './plural.js'
    import type { EighteenSeventeenSession } from './session.svelte.js'
    let { session }: { session: EighteenSeventeenSession } = $props()
    const money = $derived(session.presentation.money)
    const gameState = $derived(session.gameState)
    const valid = $derived(session.validActionTypes)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
    const decision = $derived(session.mergerDecision)
    const trading = $derived(session.convertedShareTrading)
    const stations = $derived(session.conversionStations)
    const excess = $derived(session.mergerExcess)
    const waitingFor = $derived(
        gameState.activePlayerIds.map((id) => session.getPlayerName(id)).join(', ')
    )
</script>

{#if session.mergerCompanyId}
    {@const company = getCompany(gameState, session.mergerCompanyId)}
    <section aria-label="Merger round">
        <header>
            <CompanyToken appearance={session.mapView.stations[company.id]} size={24} />
            <strong>{company.name}</strong>
            <span
                >{company.shareCount} shares · {money(
                    companyMarketSpace(gameState.stockMarket, company.id).price
                )} · Treasury {money(
                    Number(cashOwnedBy(gameState, { kind: 'company', companyId: company.id }))
                )}</span
            >
        </header>
        {#if trading}
            <p>{plural(trading.remaining, 'treasury share')} at {money(trading.price)}</p>
        {/if}
        {#if stations}
            <p>
                Loans {session.loans.loans(company.id)}/{session.loans.capacity(company.id)}
                {#if stations.stations}· Needs {plural(stations.stations, 'more station')} ({money(
                        stations.cost
                    )}){/if}
            </p>
        {/if}
        {#if excess?.stations.length}<p>Over the station limit</p>
        {:else if excess?.trains.length}<p>Over the train limit</p>{/if}
        {#if valid.length && excess}
            <div class="choices">
                {#if decision}
                    {#if decision.convertsTo}<button
                            disabled={busy}
                            onclick={() => session.convertCompany()}
                            >Convert to {decision.convertsTo} shares</button
                        >{/if}
                    {#each decision.targets as target (target.companyId)}
                        <button
                            disabled={busy}
                            onclick={() => session.mergeCompanies(target.companyId)}
                            >Merge with {getCompany(gameState, target.companyId).name} ({money(
                                target.price
                            )})</button
                        >
                    {/each}
                    <button disabled={busy} onclick={() => session.passMerger()}>Pass</button>
                {/if}
                {#if trading && valid.includes('PassConvertedShares')}
                    {#if trading.purchase}<button
                            disabled={busy}
                            onclick={() => session.buyConvertedShare()}
                            >Buy a share ({money(trading.purchase.price)})</button
                        >{/if}
                    <button disabled={busy} onclick={() => session.passConvertedShares()}
                        >Pass</button
                    >
                {/if}
                {#if stations && valid.includes('FinishConversionLoans')}
                    {#if valid.includes('TakeLoan')}<button
                            disabled={busy}
                            onclick={() => session.loans.take(company.id)}>Take a loan</button
                        >{/if}
                    <button disabled={busy} onclick={() => session.finishConversionLoans()}
                        >{!stations.stations
                            ? 'Finish'
                            : stations.affordable
                              ? `Buy ${plural(stations.stations, 'station')}`
                              : 'Finish and liquidate'}</button
                    >
                {/if}
                {#if valid.includes('RemoveStation')}
                    {#each excess.stations as station (station.id)}
                        <button disabled={busy} onclick={() => session.removeStation(station.id)}
                            >Remove {EighteenSeventeenMap.location(station.position.locationId)
                                .name ?? station.position.locationId}</button
                        >
                    {/each}
                {/if}
                {#if valid.includes('DiscardMergedTrain')}
                    {#each excess.trains as train (train.id)}
                        <button disabled={busy} onclick={() => session.discardMergedTrain(train.id)}
                            >Discard <TrainBadge
                                name={session.trainDepot.trainDefinition(train.definitionId).name}
                                color={session.presentation.trainColors[train.definitionId]}
                            /></button
                        >
                    {/each}
                {/if}
            </div>
        {:else}
            <p>Waiting for {waitingFor}.</p>
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
