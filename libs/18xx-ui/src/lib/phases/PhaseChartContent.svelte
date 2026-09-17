<script lang="ts">
    import type { TrainDepot, TrainInventory } from '@tabletop/18xx'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import { TileColors } from '../tiles/tilePresentation.js'
    import type { PhaseChartData } from './phaseChart.js'
    let {
        chart,
        depotView,
        currentPhaseId,
        trainColors,
    }: {
        depotView?: { depot: TrainDepot; inventory: TrainInventory; availableDefinitionIds: readonly string[] }
        chart: PhaseChartData
        currentPhaseId: string
        trainColors: Readonly<Record<string, string>>
    } = $props()
</script>
<div class="phase-chart-content" class:depot={!!depotView}>
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
</div>
<style>
    .phase-chart-content { container-type: inline-size; color: var(--rail-text, #463e35); }
    .depot .charts { grid-template-columns: minmax(0, 1fr); }
    .exhausted { color: var(--rail-muted, #958878); opacity: var(--rail-phase-opacity, .55); }
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
    @container (max-width: 740px) {
        .charts {
            grid-template-columns: 1fr;
            gap: 18px;
        }
    }
</style>
