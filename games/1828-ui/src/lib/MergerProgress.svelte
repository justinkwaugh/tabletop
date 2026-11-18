<script lang="ts">
    import { CompanyToken, DecisionResponse } from '@tabletop/18xx-ui'
    import MergerHeading from './MergerHeading.svelte'
    import MergerOutcome from './MergerOutcome.svelte'
    import type { PreviewSingle } from '@tabletop/1828'
    import type { Session1828 } from './session.svelte.js'
    let { session }: { session: Session1828 } = $props()
    const money = $derived(session.presentation.money)
    const initials = (companyId: string) => session.companyInitials(companyId)
    const saleNote = 'counts as a sale of the system'
    function shareContext({
        companyId,
        canTradeUp,
        canSell,
        sellFails
    }: Pick<PreviewSingle, 'companyId' | 'canTradeUp' | 'canSell' | 'sellFails'>): string {
        const share = `Your single ${initials(companyId)} share`
        if (!canSell) return `${share} must trade up`
        if (sellFails && canTradeUp) return `${share}: trade up, or sell and the merger fails`
        if (!canTradeUp) return `${share} must be sold, which ${saleNote}`
        return `${share}: trade up, or sell, which ${saleNote}`
    }
    const context = $derived.by(() => {
        if (!session.merger) return undefined
        const proposer = session.getPlayerName(session.merger.proposerId)
        if (session.mergerConsent) {
            const directed = session.mergerConsentCompany
            return `Merger proposed by ${proposer}${directed ? ` · you direct ${initials(directed)}` : ''}`
        }
        if (session.choosingMergerStation)
            return 'Choose on the map the station that becomes blocking'
        if (session.mergerSetAside.length) return 'Choose your single share to set aside'
        const decision = session.mergerShareDecision
        if (decision) return shareContext(decision)
        return session.mergerWaiting ?? `Merger proposed by ${proposer}`
    })
</script>

{#if session.merger}
    {@const { merger, preview } = session.merger}
    <section class="centered-panel merger" aria-label="Merger">
        <header>
            <MergerHeading
                {session}
                first={merger.absorbedId}
                second={merger.survivorId}
                joiner="→"
                label={`Merging ${initials(merger.absorbedId)} into ${initials(merger.survivorId)}`}
            />
            {#if context}<p>{context}</p>{/if}
        </header>
        {#if session.mergerConsent}
            <DecisionResponse
                label="Merger consent"
                acceptLabel="Agree"
                declineLabel="Refuse"
                disabled={session.actionsLocked}
                onAccept={() => session.answerMerger(true)}
                onDecline={() => session.answerMerger(false)}
            />
        {:else if session.mergerSetAside.length}
            <div class="choices" role="group" aria-label="Single share to set aside">
                {#each session.mergerSetAside as { companyId, price } (companyId)}
                    <button
                        class="station"
                        disabled={session.actionsLocked}
                        aria-label={`Set aside a ${initials(companyId)} share`}
                        onclick={() => session.chooseSetAside(companyId)}
                        ><CompanyToken
                            appearance={session.mapView.stations[companyId]}
                            size={24}
                        /><span>{initials(companyId)} {money(price)}</span></button
                    >
                {/each}
            </div>
        {:else if session.mergerShareDecision}
            {@const decision = session.mergerShareDecision}
            <div class="choices" role="group" aria-label="Single share">
                {#if decision.canTradeUp}
                    <button
                        class="action-button"
                        disabled={session.actionsLocked}
                        onclick={() => session.decideMergerShare(true)}
                        >Trade up {decision.cost >= 0 ? 'paying' : 'receiving'}
                        {money(Math.abs(decision.cost))}</button
                    >
                {/if}
                {#if decision.canSell}
                    <button
                        class="action-button"
                        disabled={session.actionsLocked}
                        onclick={() => session.decideMergerShare(false)}
                        >Sell for {money(decision.price)}</button
                    >
                {/if}
            </div>
        {/if}
        <MergerOutcome {session} {preview} />
    </section>
{/if}

<style>
    .merger {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 6px 0;
        font-size: 13px;
        text-align: center;
        color: var(--rail-text, #514536);
    }
    header {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
    }
    p {
        max-width: 440px;
        margin: 0;
        color: var(--rail-muted, #887969);
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
    }
    .choices .action-button {
        padding: 6px 14px;
        border-radius: 4px;
        font-size: 13px;
    }
    .station {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 12px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 6px;
        background: var(--rail-surface, #fbf7f0);
        color: var(--rail-text, #514536);
        cursor: pointer;
    }
    .station:hover:not(:disabled) {
        background: var(--rail-hover, #efe7db);
    }
    button:disabled {
        opacity: 0.5;
        cursor: default;
    }
</style>
