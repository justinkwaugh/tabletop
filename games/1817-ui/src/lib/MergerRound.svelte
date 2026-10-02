<script lang="ts">
    import { getCompany } from '@tabletop/18xx'
    import { plural } from './plural.js'
    import RoundPanel from './RoundPanel.svelte'
    import type { EighteenSeventeenSession } from './session.svelte.js'
    let { session, companyId }: { session: EighteenSeventeenSession; companyId: string } = $props()
    const money = $derived(session.presentation.money)
    const gameState = $derived(session.gameState)
    const valid = $derived(session.validActionTypes)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
    const decision = $derived(session.mergerDecision)
    const trading = $derived(session.convertedShareTrading)
    const stations = $derived(session.conversionStations)
</script>

<RoundPanel {session} label="Merger round" {companyId}>
    {#if trading}
        <p>{plural(trading.remaining, 'treasury share')} at {money(trading.price)}</p>
    {/if}
    {#if stations}
        <p>
            Loans {session.loans.loans(companyId)}/{session.loans.capacity(companyId)}
            {#if stations.stations}· Needs {plural(stations.stations, 'more station')} ({money(
                    stations.cost
                )}){/if}
        </p>
    {/if}
    {#if valid.length}
        <div class="choices">
            {#if decision}
                {#if decision.convertsTo}<button
                        disabled={busy}
                        onclick={() => session.convertCompany()}
                        >Convert to {decision.convertsTo} shares</button
                    >{/if}
                {#each decision.targets as target (target.companyId)}
                    <button disabled={busy} onclick={() => session.mergeCompanies(target.companyId)}
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
                <button disabled={busy} onclick={() => session.passConvertedShares()}>Pass</button>
            {/if}
            {#if stations && valid.includes('FinishConversionLoans')}
                {#if valid.includes('TakeLoan')}<button
                        disabled={busy}
                        onclick={() => session.loans.take(companyId)}>Take a loan</button
                    >{/if}
                <button disabled={busy} onclick={() => session.finishConversionLoans()}
                    >{!stations.stations
                        ? 'Finish'
                        : stations.affordable
                          ? `Buy ${plural(stations.stations, 'station')}`
                          : 'Finish and liquidate'}</button
                >
            {/if}
        </div>
    {/if}
</RoundPanel>
