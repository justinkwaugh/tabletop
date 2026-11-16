<script lang="ts">
    import { finiteCashOwnedBy } from '@tabletop/18xx'
    import { loansOwed } from '@tabletop/1856'
    import {
        CompanyActionCard,
        StockPanelHeading,
        TrainBadge,
        type CardAction
    } from '@tabletop/18xx-ui'
    import type { Session1856 } from './session.svelte.js'
    let { session }: { session: Session1856 } = $props()
    const money = $derived(session.presentation.money)
    const gameState = $derived(session.gameState)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
    const name = (id: string) => session.companyName(id)
    const trainName = (definitionId: string) =>
        session.trainDepot.trainDefinition(definitionId).name

    function companyFacts(companyId: string) {
        return [
            {
                label: 'Treasury',
                value: money(finiteCashOwnedBy(gameState, { kind: 'company', companyId }))
            },
            { label: 'Loans owed', value: money(loansOwed(gameState, companyId)) }
        ]
    }
    function companyActions(entry: {
        companyId: string
        topUp: number
        affordable: boolean
    }): CardAction[] {
        return [
            {
                label: `Repay ${money(entry.topUp)}`,
                ariaLabel: `Repay ${name(entry.companyId)}’s loans, ${money(entry.topUp)} from your own cash`,
                disabled: busy || !entry.affordable,
                onclick: () => session.settleNationalLoans(entry.companyId, true)
            },
            {
                label: 'Join the CGR',
                ariaLabel: `Let the CGR absorb ${name(entry.companyId)}`,
                disabled: busy,
                onclick: () => session.settleNationalLoans(entry.companyId, false)
            }
        ]
    }
</script>

<section aria-label="Canadian Government Railways" class="national">
    <StockPanelHeading text="Canadian Government Railways" />
    {#if session.loanDecision}
        <p>
            The treasury has repaid all it could. Pay the rest from your own cash, without selling
            shares, or the CGR absorbs the company.
        </p>
        <div class="cards">
            {#each session.loanDecision as entry (entry.companyId)}
                <CompanyActionCard
                    {session}
                    companyId={entry.companyId}
                    title={name(entry.companyId)}
                    facts={companyFacts(entry.companyId)}
                    actions={companyActions(entry)}
                />
            {/each}
        </div>
    {/if}

    {#if session.stationChoice}
        {@const choice = session.stationChoice}
        <h3>Keep {choice.keep} station{choice.keep === 1 ? '' : 's'}, one a tile</h3>
        <p class="note">The homes are already the CGR’s.</p>
        <div class="choices">
            {#each choice.stations as station (station.stationId)}
                <button
                    class="toggle"
                    aria-pressed={choice.chosen.includes(station.stationId)}
                    disabled={busy}
                    onclick={() => session.toggleStation(station.stationId)}
                    >{session.placeName(station.locationId)}
                    <span class="detail">{station.companyId}</span></button
                >
            {/each}
        </div>
        {#if choice.reason}<p class="note">{choice.reason}</p>{/if}
        <div class="choices">
            <button
                class="action-button"
                disabled={busy || !!choice.reason}
                onclick={() => session.chooseStations()}>Keep these</button
            >
        </div>
    {/if}

    {#if session.trainChoice}
        {@const choice = session.trainChoice}
        <h3>Keep up to three trains</h3>
        <p class="note">The CGR keeps its permanent trains; the rest go to the open market.</p>
        <div class="choices">
            {#each choice.trains as train (train.trainId)}
                <button
                    class="train"
                    aria-label={`Keep ${trainName(train.definitionId)}${train.permanent ? ', permanent' : ''}`}
                    aria-pressed={choice.chosen.includes(train.trainId)}
                    disabled={busy}
                    onclick={() => session.toggleTrain(train.trainId)}
                    ><TrainBadge
                        name={trainName(train.definitionId)}
                        color={session.presentation.trainColors[train.definitionId]}
                        title={train.permanent ? 'Permanent' : undefined}
                    /></button
                >
            {/each}
        </div>
        {#if choice.reason}<p class="note">{choice.reason}</p>{/if}
        <div class="choices">
            <button
                class="action-button"
                disabled={busy || !!choice.reason}
                onclick={() => session.chooseTrains()}>Keep these</button
            >
        </div>
    {/if}
</section>

<style>
    section {
        container-type: inline-size;
        padding: 6px 0;
        font-size: 12px;
        color: var(--rail-text, #514536);
        text-align: center;
    }
    .cards {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 10px;
        margin-top: 8px;
    }
    h3 {
        margin: 10px 0 4px;
        font-size: 12px;
        font-weight: 400;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }
    p {
        margin: 4px 0;
    }
    .note {
        color: var(--rail-muted, #887969);
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
        margin-top: 4px;
    }
    .detail {
        color: var(--rail-muted, #887969);
    }
    .choices button {
        min-height: 30px;
        padding: 3px 14px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 6px;
        cursor: pointer;
    }
    .choices button:disabled {
        opacity: 0.35;
        cursor: default;
    }
    .choices .train {
        --train-badge-font: 16px;
        min-height: 0;
        padding: 6px;
        border-color: transparent;
        background: var(--rail-surface-raised, #efe7db);
    }
    .choices .train[aria-pressed='true'] {
        border-color: var(--rail-focus, #796047);
        background: var(--rail-surface-selected, #e6dccd);
    }
    .toggle {
        background: var(--rail-surface, #fbf7f0);
        color: var(--rail-text, #514536);
    }
    .toggle[aria-pressed='true'] {
        border-color: var(--rail-focus, #443e35);
        background: var(--rail-surface-raised, #efe7db);
        font-weight: 600;
    }
</style>
