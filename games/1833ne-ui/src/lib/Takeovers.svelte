<script lang="ts">
    import type { Owner } from '@tabletop/18xx'
    import { vulnerable } from '@tabletop/1833ne'
    import { CompanyToken, DecisionResponse, TrainBadge, trainCount } from '@tabletop/18xx-ui'
    import type { Session1833NE } from './session.svelte.js'
    import { holderKey, holderName as nameHolder, offerText } from './takeovers.js'
    let { session }: { session: Session1833NE } = $props()
    const money = $derived(session.presentation.money)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
    const initials = (companyId: string) => session.companyInitials(companyId)
    const holderName = (holder: Owner) => nameHolder(holder, session.takeoverNames)
</script>

{#snippet token(companyId: string, size: number)}
    <CompanyToken appearance={session.mapView.stations[companyId]} {size} />
{/snippet}

{#if session.takeoverAnswer}
    {@const offer = session.takeoverAnswer}
    <section class="centered-panel" aria-label="Takeover offer">
        <DecisionResponse
            label="Takeover offer"
            disabled={busy}
            onAccept={() => session.answerTakeover(true)}
            onDecline={() => session.answerTakeover(false)}
        >
            {@render token(offer.companyId, 24)}{@render token(offer.targetId, 24)}
            <span>
                {initials(offer.companyId)} offers to take over {initials(offer.targetId)},
                {offerText(session.gameState, offer, session.takeoverNames)}.
            </span>
        </DecisionResponse>
    </section>
{:else if session.takeoverTurnIns}
    {@const turnIns = session.takeoverTurnIns}
    {@const chosen = session.turnInChoice}
    {@const trainName = (definitionId: string) =>
        session.trainDepot.trainDefinition(definitionId).name}
    <section class="centered-panel turn-ins" aria-label="Train turn-ins">
        <h3>
            {@render token(turnIns.companyId, 24)}
            <strong>{session.companyName(turnIns.companyId)}</strong>
            <span>turns in {trainCount(turnIns.excess)}</span>
        </h3>
        <p class="note">Its train limit is now {turnIns.limit}. Turned-in trains go to the bank.</p>
        <div class="trains" role="group" aria-label="Trains to turn in">
            {#each turnIns.kinds as { definitionId, trainIds } (definitionId)}
                <button
                    class="train"
                    aria-label={`Choose a ${trainName(definitionId)} to turn in`}
                    aria-pressed={chosen?.definitionId === definitionId}
                    disabled={busy}
                    onclick={() => session.chooseTurnIn(definitionId)}
                    ><TrainBadge
                        name={trainName(definitionId)}
                        color={session.presentation.trainColors[definitionId]}
                    />{#if trainIds.length > 1}<span class="count">×{trainIds.length}</span
                        >{/if}</button
                >
            {/each}
        </div>
        {#if chosen}
            <button
                class="action-button"
                disabled={busy}
                onclick={() => session.turnInChosenTrain()}
                >Turn in a {trainName(chosen.definitionId)}</button
            >
        {/if}
    </section>
{:else if session.takeoverCompanyId}
    {@const companyId = session.takeoverCompanyId}
    {@const targetId = session.takeoverTargetId}
    {@const terms = session.takeoverTerms}
    <section class="centered-panel offer" aria-label="Takeover">
        <h3>
            {@render token(companyId, 22)}
            <strong>{initials(companyId)}</strong>
            <span>may take over</span>
        </h3>
        <div class="targets" role="group" aria-label="Corporations to take over">
            {#each session.takeoverTargetIds as id (id)}
                <button
                    class="target"
                    aria-pressed={id === targetId}
                    aria-label={session.companyName(id)}
                    disabled={busy}
                    onclick={() => session.chooseTakeoverTarget(id)}
                    >{@render token(id, 34)}<span>{initials(id)}</span></button
                >
            {/each}
        </div>
        {#if targetId && terms}
            <p class="note">
                Each outstanding {initials(targetId)} share is redeemed at {money(terms.price)}, in
                cash or for one unissued {initials(companyId)} share.
                {vulnerable(session.gameState, targetId)
                    ? `${initials(targetId)} has no running trains and cannot refuse.`
                    : `${initials(targetId)}’s president may refuse.`}
            </p>
            <table class="holdings" aria-label="Shares redeemed">
                <thead>
                    <tr>
                        <th>Holder</th>
                        <th>{initials(targetId)} shares</th>
                        <th>For {initials(companyId)} shares</th>
                        <th>Plus cash</th>
                    </tr>
                </thead>
                <tbody>
                    {#each terms.holdings as holding (holderKey(holding.holder))}
                        {@const swapped = holding.swapped}
                        <tr>
                            <td>{holderName(holding.holder)}</td>
                            <td>{holding.shares}</td>
                            <td class="stepper">
                                <button
                                    aria-label={`Fewer ${initials(companyId)} shares to ${holderName(holding.holder)}`}
                                    disabled={busy || swapped === 0}
                                    onclick={() =>
                                        session.setTakeoverSwaps(holding.holder, swapped - 1)}
                                    >−</button
                                ><span>{swapped}</span><button
                                    aria-label={`More ${initials(companyId)} shares to ${holderName(holding.holder)}`}
                                    disabled={busy || swapped >= holding.maximumSwaps}
                                    onclick={() =>
                                        session.setTakeoverSwaps(holding.holder, swapped + 1)}
                                    >+</button
                                >
                            </td>
                            <td>{money(holding.cash)}</td>
                        </tr>
                    {/each}
                </tbody>
                <tfoot>
                    <tr>
                        <th>Total</th>
                        <td></td>
                        <td>{terms.swapped} of {session.takeoverSwapLimit}</td>
                        <td>{money(terms.cash)}</td>
                    </tr>
                </tfoot>
            </table>
            {#if session.takeoverOfferReason}<p class="reason" role="alert">
                    {session.takeoverOfferReason}
                </p>{/if}
        {/if}
        <div class="controls">
            {#if targetId}
                <button
                    class="action-button"
                    disabled={busy || !!session.takeoverOfferReason}
                    onclick={() => session.offerTakeover()}>Take over {initials(targetId)}</button
                >
            {/if}
            <button class="action-button" disabled={busy} onclick={() => session.passTakeover()}
                >Pass</button
            >
        </div>
    </section>
{/if}

<style>
    section {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        text-align: center;
        color: var(--rail-text, #514536);
    }
    h3 {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: 0;
        font-size: 14px;
        font-weight: 400;
    }
    h3 strong {
        font-weight: 650;
    }
    .note {
        margin: 0;
        max-width: 34rem;
        color: var(--rail-muted, #887969);
        font-size: 12px;
    }
    .targets,
    .trains,
    .controls {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
    }
    .target,
    .train {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 8px;
        border: 1px solid transparent;
        border-radius: 6px;
        background: var(--rail-surface-raised, #efe7db);
        color: inherit;
        font-weight: 600;
        cursor: pointer;
    }
    .target[aria-pressed='true'],
    .train[aria-pressed='true'] {
        border-color: var(--rail-focus, #796047);
        background: var(--rail-surface-selected, #e6dccd);
    }
    .target:disabled,
    .train:disabled {
        cursor: default;
    }
    .train {
        --train-badge-font: 16px;
        padding: 6px;
    }
    .count {
        padding-right: 2px;
        font-size: 13px;
    }
    .holdings {
        border-collapse: collapse;
        font-variant-numeric: tabular-nums;
    }
    .holdings th,
    .holdings td {
        padding: 3px 8px;
        text-align: right;
    }
    .holdings th:first-child,
    .holdings td:first-child {
        text-align: left;
    }
    .holdings thead th {
        color: var(--rail-muted, #887969);
        font-weight: 400;
        font-size: 12px;
    }
    .holdings tfoot th,
    .holdings tfoot td {
        border-top: 1px solid var(--rail-border, #c7b8a6);
        font-weight: 700;
    }
    .stepper {
        white-space: nowrap;
    }
    .stepper span {
        display: inline-block;
        min-width: 1.6em;
        text-align: center;
    }
    .stepper button {
        width: 24px;
        height: 24px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 4px;
        background: var(--rail-surface-raised, #efe7db);
        color: inherit;
        cursor: pointer;
    }
    .stepper button:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .action-button {
        padding: 6px 14px;
        border-radius: 4px;
        font-size: 13px;
    }
    .reason {
        margin: 0;
        color: var(--rail-warning, #a3442f);
    }
</style>
