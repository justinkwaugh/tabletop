<script lang="ts">
    import { getCompany, controllingOwner } from '@tabletop/18xx'
    import type { FinanceExampleSession } from './financeExampleSession.svelte.js'
    let { session, showUndo = true }: { showUndo?: boolean; session: FinanceExampleSession } =
        $props()
    const state = $derived(session.financialState)
    const change = $derived(state.phaseChange)
    const companyId = $derived(session.discardCompanyId)
    const owner = $derived(companyId ? controllingOwner(state, companyId) : undefined)
</script>

<section aria-label="Phase changes">
    <strong>Phase {state.phaseId}</strong>
    {#if change && companyId && owner}
        <div aria-label="Compulsory train discard">
            <h2>
                {getCompany(state, companyId).name} · Discard {session.discardCount} excess {session.discardCount ===
                1
                    ? 'train'
                    : 'trains'}
            </h2>
            <p>
                {session.ownerName(owner)} decides. Then {getCompany(
                    state,
                    change.continuation.companyId
                ).name} resumes {change.continuation.machineState === 'BuyingTrains'
                    ? 'buying trains'
                    : change.continuation.machineState}.
            </p>
            <div class="choices">
                {#each session.discardTrains as train}<button
                        disabled={!session.canDiscardTrain}
                        aria-pressed={session.discardSelection === train.id}
                        onclick={() => session.selectDiscard(train.id)}
                        >Discard {session.trainDepot.trainDefinition(train.definitionId).name} ({train.id})</button
                    >{/each}
            </div>
            {#if session.discardSelection}<button onclick={() => session.backDiscard()}>Back</button
                ><button
                    disabled={!session.canDiscardTrain}
                    onclick={() => session.confirmDiscard()}>Confirm discard</button
                >{/if}
            {#if showUndo}<button
                    disabled={session.busy ||
                        session.updatingVisibleState ||
                        session.isViewingHistory}
                    onclick={() => session.undo()}>Undo</button
                >{/if}
        </div>
    {/if}
    {#if state.phaseEvents.length}<ol aria-label="Phase history">
            {#each state.phaseEvents as event (event.id)}<li>
                    Phase {event.fromPhaseId} → {event.toPhaseId}
                    {#if event.rustedTrainIds.length}
                        · Rusted: {event.rustedTrainIds.join(', ')}{/if}
                    {#if event.pendingRustTrainIds.length}
                        · Rusts after its next operation: {event.pendingRustTrainIds.join(
                            ', '
                        )}{/if}
                    {#each event.privateEffects as effect}
                        <div>
                            {#if effect.kind === 'close'}Closed {effect.privateCompanyId}
                            {:else if effect.kind === 'income'}{effect.privateCompanyId} revenue becomes
                                {effect.revenue}
                            {:else}Exchanged {effect.privateCompanyId} for {effect.certificateId}{/if}
                        </div>
                    {/each}
                </li>{/each}
        </ol>{/if}
</section>

<style>
    section {
        padding: 16px;
        margin-bottom: 16px;
        border: 1px solid var(--rail-border, #c9d2cb);
        border-radius: 7px;
        background: var(--rail-surface, #fffefa);
        font:
            13px/1.5 ui-sans-serif,
            system-ui,
            sans-serif;
    }
    h2 {
        font-size: 17px;
        margin: 10px 0;
    }
    .choices {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
    }
    button {
        padding: 7px 12px;
        font: inherit;
        cursor: pointer;
        background: var(--rail-surface, #fffefa);
        border: 1px solid var(--rail-border, #b5c3ba);
        border-radius: 4px;
    }
    button:disabled {
        opacity: 0.5;
        cursor: default;
    }
    button[aria-pressed='true'] {
        outline: 2px solid #d67910;
    }
</style>
