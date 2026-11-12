<script lang="ts">
    import { controllingOwner } from '@tabletop/18xx'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import { trainCount } from '../table/awaitedDecision.js'
    let { session, showUndo = true }: { showUndo?: boolean; session: EighteenXXSessionView } =
        $props()
    const gameState = $derived(session.gameState)
    const trainColors = $derived(session.presentation.trainColors)
    const phaseColors = $derived(session.presentation.phaseColors)
    const change = $derived(gameState.phaseChange)
    const companyId = $derived(session.discard.companyId)
    const owner = $derived(companyId ? controllingOwner(gameState, companyId) : undefined)
    const limit = $derived(session.discard.trains.length - session.discard.excess)
    const trainName = (definitionId: string) =>
        session.trainDepot.trainDefinition(definitionId).name
    const event = $derived(session.discard.phaseEvent)
    const consequences = $derived.by((): { definitionId?: string; text: string }[] => {
        if (!event) return []
        const rusted = new Map<string, number>()
        for (const train of event.rustedTrains)
            rusted.set(train.definitionId, (rusted.get(train.definitionId) ?? 0) + 1)
        const closed = event.privateEffects.flatMap((effect) =>
            effect.kind === 'close' ? [session.companyName(effect.privateCompanyId)] : []
        )
        const otherEffects = event.privateEffects.flatMap((effect) =>
            effect.kind === 'income'
                ? [
                      {
                          text: `${session.companyName(effect.privateCompanyId)} now pays ${session.presentation.money(effect.revenue)}`
                      }
                  ]
                : effect.kind === 'exchange'
                  ? [
                        {
                            text: `${session.companyName(effect.privateCompanyId)} exchanged for ${effect.shares === 1 ? 'a share' : `${effect.shares} shares`} of ${session.companyName(effect.companyId)}`
                        }
                    ]
                  : []
        )
        return [
            ...[...rusted].map(([definitionId, count]) => ({
                definitionId,
                text: count === 1 ? 'rusted' : `×${count} rusted`
            })),
            ...(event.pendingRustTrainIds.length
                ? [
                      {
                          text:
                              event.pendingRustTrainIds.length === 1
                                  ? '1 train rusts after its next run'
                                  : `${event.pendingRustTrainIds.length} trains rust after their next run`
                      }
                  ]
                : []),
            ...(closed.length ? [{ text: `Closed: ${closed.join(', ')}` }] : []),
            ...otherEffects
        ]
    })
    const selected = $derived(
        session.discard.trains.find((train) => train.id === session.discard.selection)
    )
</script>

<section aria-label="Phase changes">
    {#if change}
        <h2 class="phase">
            Phase <TrainBadge
                name={change.event.fromPhaseId}
                color={phaseColors[change.event.fromPhaseId]}
            />
            <span aria-label="to">→</span>
            <TrainBadge name={change.event.toPhaseId} color={phaseColors[change.event.toPhaseId]} />
        </h2>
        {#if consequences.length}<p class="event">
                {#each consequences as consequence, index (index)}
                    <span class="consequence"
                        >{#if consequence.definitionId}<TrainBadge
                                name={trainName(consequence.definitionId)}
                                color={trainColors[consequence.definitionId]}
                            />{/if}
                        {consequence.text}</span
                    >
                {/each}
            </p>{/if}
    {/if}
    {#if change && companyId}
        <div class="discard" aria-label="Compulsory train discard">
            <h2>
                <CompanyToken appearance={session.mapView.stations[companyId]} size={24} />
                <strong>{session.companyName(companyId)}</strong>
                <span>discards {trainCount(session.discard.excess)}</span>
            </h2>
            <p class="note">
                The train limit is now {limit}.
                {owner
                    ? session.ownerName(owner)
                    : gameState.activePlayerIds.map((id) => session.getPlayerName(id)).join(' / ')} chooses.
                {#if change.continuation.companyId}Then {session.companyName(
                        change.continuation.companyId
                    )} resumes {change.continuation.machineState === 'BuyingTrains'
                        ? 'buying trains'
                        : change.continuation.machineState}.{:else}Then the operating round ends.{/if}
            </p>
            <div class="choices">
                {#each session.discard.trains as train (train.id)}<button
                        class="train"
                        aria-label={`Discard ${trainName(train.definitionId)}`}
                        disabled={!session.discard.canDiscard}
                        aria-pressed={session.discard.selection === train.id}
                        onclick={() => session.discard.select(train.id)}
                        ><TrainBadge
                            name={trainName(train.definitionId)}
                            color={trainColors[train.definitionId]}
                        /></button
                    >{/each}
            </div>
            <div class="controls">
                {#if selected}<button
                        class="action-button"
                        disabled={!session.discard.canDiscard}
                        onclick={() => session.discard.confirm()}
                        >Discard {trainName(selected.definitionId)}</button
                    >{/if}
                {#if showUndo}<button
                        disabled={session.busy ||
                            session.updatingVisibleState ||
                            session.isViewingHistory}
                        onclick={() => session.undo()}>Undo</button
                    >{/if}
            </div>
        </div>
    {/if}
</section>

<style>
    section {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 8px 0 12px;
        color: var(--rail-text, #514536);
        font:
            13px/1.5 ui-sans-serif,
            system-ui,
            sans-serif;
        text-align: center;
    }
    .event {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: 4px 14px;
        margin: 0;
        color: var(--rail-muted, #887664);
    }
    h2.phase {
        --train-badge-font: 18px;
        gap: 8px;
        font-size: 18px;
        font-weight: 650;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }
    .consequence {
        display: inline-flex;
        align-items: center;
        gap: 5px;
    }
    .discard {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
    }
    h2 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 14px;
        font-weight: 400;
    }
    h2 strong {
        font-weight: 650;
    }
    .note {
        margin: 0;
        color: var(--rail-muted, #887664);
        font-size: 12px;
    }
    .choices,
    .controls {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
    }
    .train {
        --train-badge-font: 16px;
        padding: 6px;
        border: 1px solid transparent;
        border-radius: 6px;
        background: var(--rail-surface-raised, #efe7db);
        cursor: pointer;
    }
    .train[aria-pressed='true'] {
        border-color: var(--rail-focus, #796047);
        background: var(--rail-surface-selected, #e6dccd);
    }
    .train:disabled {
        cursor: default;
    }
    .controls button {
        padding: 6px 14px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 4px;
        color: inherit;
        font: inherit;
        cursor: pointer;
    }
    .controls button:not(.action-button) {
        background: transparent;
    }
    button:disabled {
        opacity: 0.5;
        cursor: default;
    }
</style>
