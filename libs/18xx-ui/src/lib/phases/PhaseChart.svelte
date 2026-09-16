<script lang="ts">
    import type { TrainDepot, TrainInventory } from '@tabletop/18xx'
    import { onMount } from 'svelte'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import { TileColors } from '../tiles/tilePresentation.js'
    import type { PhaseChartData } from './phaseChart.js'

    let {
        chart,
        depotView,
        currentPhaseId,
        trainColors,
        onclose
    }: {
        depotView?: { depot: TrainDepot; inventory: TrainInventory; availableDefinitionIds: readonly string[] }
        chart: PhaseChartData
        currentPhaseId: string
        trainColors: Readonly<Record<string, string>>
        onclose: () => void
    } = $props()
    let dialog: HTMLDialogElement
    const titleId = $props.id()
    onMount(() => {
        dialog.showModal()
        return () => dialog.close()
    })
    function closeOutside(event: MouseEvent) {
        if (event.target !== dialog) return
        const bounds = dialog.getBoundingClientRect()
        if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
        )
            dialog.close()
    }
</script>

<dialog class:depot={!!depotView} bind:this={dialog} aria-labelledby={titleId} {onclose} onclick={closeOutside}>
    <header>
        <h2 id={titleId}>{depotView ? 'Train Depot' : 'Phase Chart & Train Roster'}</h2>
        <button class="close" aria-label={depotView ? 'Close depot' : 'Close phase chart'} onclick={() => dialog.close()}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"
                ><path
                    d="m4 4 8 8m0-8-8 8"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linecap="round"
                /></svg
            >
        </button>
    </header>
    <div class="charts">
        {#if !depotView}
        <section aria-label="Phases">
            <table>
                <thead
                    ><tr
                        ><th>Phase</th><th>Tiles</th><th>ORs</th><th>Train limit</th><th
                            >Rusts</th
                        ><th>Notes</th></tr
                    ></thead
                >
                <tbody>
                    {#each chart.phases as phase (phase.id)}
                        <tr
                            class:current={phase.id === currentPhaseId}
                            aria-current={phase.id === currentPhaseId ? 'step' : undefined}
                        >
                            <th scope="row"
                                ><TrainBadge name={phase.id} color={trainColors[phase.id]} /></th
                            >
                            <td
                                ><span class="colors" aria-label={phase.tileColors.join(', ')}>
                                    {#each phase.tileColors as color}<span
                                            class="tile-color"
                                            style:background={TileColors[color]}
                                            title={color}
                                        ></span>{/each}
                                </span></td
                            >
                            <td class="number">{phase.operatingRounds}</td>
                            <td class="number">{phase.trainLimit}</td>
                            <td
                                ><span class="badges">
                                    {#each chart.trains.filter((train) => train.rustPhaseId === phase.id) as train}
                                        <TrainBadge
                                            name={train.id}
                                            color={trainColors[train.id]}
                                        />{#if train.rustNote}<span>*</span>{/if}
                                    {:else}<span class="muted">—</span>{/each}
                                </span></td
                            >
                            <td class="phase-notes">{phase.notes ?? ''}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </section>
        {/if}
        <section aria-label="Train roster">
            <table>
                <thead
                    ><tr><th>Train</th><th class="money">Price</th><th>{depotView ? 'Remaining' : 'Qty'}</th><th>Rusts in phase</th></tr
                    ></thead
                >
                <tbody>
                    {#each chart.trains as train (train.id)}
                        {@const remaining = depotView ? depotView.depot.remaining(depotView.inventory, train.id) : train.count}
                        {@const current = depotView?.availableDefinitionIds.includes(train.id) && remaining !== 0}
                        <tr class:current aria-current={current ? 'step' : undefined} class:exhausted={!!depotView && remaining === 0}>
                            <th scope="row"
                                ><TrainBadge name={train.name} color={trainColors[train.id]} /></th
                            >
                            <td class="money">${train.price.toLocaleString('en-US')}</td>
                            <td class="number">{remaining === 'unlimited' ? '∞' : remaining}</td
                            >
                            <td
                                >{#if train.rustPhaseId}<TrainBadge
                                        name={train.rustPhaseId}
                                        color={trainColors[train.rustPhaseId]}
                                    />{#if train.rustNote}
                                        *{/if}{:else}<span class="muted">Permanent</span>{/if}</td
                            >
                        </tr>
                    {/each}
                </tbody>
            </table>
        </section>
    </div>
    <div class="notes">
        {#each chart.trains.filter((train) => train.rustNote) as train}<p>
                * {train.rustNote}
            </p>{/each}
        {#if !depotView}{#each chart.notes as note}<p>{note}</p>{/each}{/if}
    </div>
</dialog>

<style>
    dialog {
        margin: auto;
        box-sizing: border-box;
        width: min(850px, calc(100vw - 40px));
        max-height: calc(100dvh - 48px);
        padding: 0;
        border: 1px solid var(--rail-border, #c3b39e);
        border-radius: 10px;
        background: var(--rail-surface, #faf7f1);
        color: var(--rail-text, #463e35);
        box-shadow: 0 20px 70px var(--rail-shadow, #16120d55);
    }
    dialog.depot { width: min(430px, calc(100vw - 40px)); }
    .depot .charts { grid-template-columns: minmax(0, 1fr); }
    .exhausted { color: var(--rail-muted, #958878); opacity: var(--rail-phase-opacity, .55); }
    dialog::backdrop {
        background: var(--rail-backdrop, #17141099);
    }
    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        padding: 10px 16px;
        border-bottom: 1px solid var(--rail-border, #ded4c7);
    }
    h2 {
        margin: 0;
        font-size: 17px;
        font-weight: 650;
    }
    .close {
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 4px;
        background: transparent;
        color: var(--rail-text, #766653);
        cursor: pointer;
    }
    .close:hover {
        background: var(--rail-surface-raised, #e9e1d5);
    }
    button:focus-visible {
        outline: 2px solid var(--rail-focus, #9e7752);
        outline-offset: 2px;
    }
    .charts {
        display: grid;
        grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
        gap: 18px;
        padding: 12px 16px 8px;
    }
    section {
        overflow-x: auto;
    }
    table {
        border-collapse: collapse;
        width: 100%;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }
    th,
    td {
        padding: 3px 5px;
        text-align: left;
        height: 18px;
    }
    thead th {
        font-size: 10px;
        color: var(--rail-text, #817261);
        font-weight: 600;
        border-bottom: 1px solid var(--rail-border, #cfc1ae);
    }
    tbody tr + tr {
        border-top: 1px solid var(--rail-border, #e9e0d4);
    }
    .phase-notes {
        width: 100%;
        min-width: 185px;
        white-space: normal;
        font-size: 11px;
        line-height: 1.35;
        color: var(--rail-text, #766653);
    }
    .current {
        background: var(--rail-surface-raised, #e9dfcc);
        box-shadow: inset 3px 0 var(--rail-shadow, #786447);
    }
    .number {
        text-align: center;
    }
    .money {
        text-align: right;
    }
    .colors,
    .badges {
        display: flex;
        gap: 3px;
        align-items: center;
    }
    .tile-color {
        width: 14px;
        height: calc(14px * cos(30deg));
        flex-shrink: 0;
        clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%);
    }
    .muted {
        color: var(--rail-muted, #958878);
        font-size: 11px;
    }
    .notes {
        padding: 0 16px 12px;
        color: var(--rail-text, #766653);
        font-size: 11px;
        line-height: 1.5;
    }
    p {
        margin: 5px 0 0;
    }
    @media (max-width: 740px) {
        .charts {
            grid-template-columns: 1fr;
            gap: 18px;
        }
    }
</style>
