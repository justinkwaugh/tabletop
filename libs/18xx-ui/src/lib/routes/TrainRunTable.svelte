<script lang="ts">
    import type { MoneyFormat } from '../presentation/money.js'
    import { isObsoleteTrain, type OperatingResult, type Train } from '@tabletop/18xx'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import { routeColor } from './routePresentation.js'

    let {
        money,
        result,
        trains,
        trainName,
        trainColors,
        onFocusRoute,
        onChooseTrain,
        onClearTrain,
        chosenTrainId,
        label = 'Train income'
    }: {
        money: MoneyFormat
        result: OperatingResult
        trains: readonly Train[]
        trainName: (definitionId: string) => string
        trainColors: Readonly<Record<string, string>>
        onFocusRoute?: (trainId: string) => void
        onChooseTrain?: (trainId: string) => void
        /** Empties the chosen train's route, offered beside its row. */
        onClearTrain?: (trainId: string) => void
        chosenTrainId?: string
        label?: string
    } = $props()
</script>

<table aria-label={label}>
    <thead><tr><th scope="col">Train</th><th scope="col">Income</th></tr></thead>
    <tbody>
        {#each trains as train, index (train.id)}
            {@const route = result.routes.find((candidate) => candidate.trainId === train.id)}
            <tr data-route-train={train.id}>
                <td colspan="2"
                    ><button
                        class="route-focus"
                        class:chosen={chosenTrainId === train.id}
                        disabled={onChooseTrain ? false : !route || !onFocusRoute}
                        aria-pressed={onChooseTrain ? chosenTrainId === train.id : undefined}
                        aria-label={`${onChooseTrain ? 'Draw' : 'Show'} ${trainName(train.definitionId)}${isObsoleteTrain(train) ? ' obsolete' : ''} route for ${money(route?.revenue ?? 0)}`}
                        onclick={() => {
                            onChooseTrain?.(train.id)
                            if (route) onFocusRoute?.(train.id)
                        }}
                        ><span class="train">
                            <span
                                class="route-color"
                                style:background={route ? routeColor(index) : '#b6afa5'}
                            ></span>
                            <TrainBadge
                                name={trainName(train.definitionId)}
                                color={trainColors[train.definitionId]}
                                obsolete={isObsoleteTrain(train)}
                            />
                        </span><span class="income">{money(route?.revenue ?? 0)}</span></button
                    >{#if onClearTrain && chosenTrainId === train.id}<button
                            class="clear"
                            aria-label={`Clear ${trainName(train.definitionId)} route`}
                            title="Clear this route"
                            onclick={() => onClearTrain(train.id)}
                            ><svg viewBox="0 0 24 24" aria-hidden="true"
                                ><path d="m7 7 10 10M17 7 7 17"></path></svg
                            ></button
                        >{/if}</td
                >
            </tr>
        {:else}<tr><td colspan="2">No trains</td></tr>{/each}
    </tbody>
    <tfoot
        ><tr><th scope="row">Total</th><td class="income">{money(result.revenue)}</td></tr
        >{#if result.subsidy}<tr class="subsidy"
                ><th scope="row">Subsidy to treasury</th><td class="income"
                    >{money(result.subsidy)}</td
                ></tr
            >{/if}</tfoot
    >
</table>

<style>
    table {
        border-collapse: collapse;
        min-width: 150px;
        font-variant-numeric: tabular-nums;
    }
    th,
    td {
        padding: 2px 0;
        text-align: left;
        line-height: 18px;
    }
    th:last-child,
    .income {
        text-align: right;
        padding-left: 24px;
    }
    thead th {
        color: var(--rail-muted, #817565);
        font-size: 10px;
        font-weight: 600;
        line-height: 14px;
    }
    tfoot th,
    tfoot td {
        border-top: 1px solid var(--rail-border, #d6cbbc);
        padding-top: 3px;
        font-weight: 650;
    }
    .route-focus {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 0;
        border: 0;
        border-radius: 3px;
        background: transparent;
        color: inherit;
    }
    .route-focus:not(:disabled):hover {
        background: var(--rail-hover, #463e350c);
    }
    .route-focus:focus-visible {
        outline: 2px solid #bd865e;
        outline-offset: 1px;
    }
    .route-focus:disabled {
        opacity: 1;
    }
    td:has(> .clear) {
        position: relative;
    }
    /* Beside the row, so the income column keeps its alignment. */
    .clear {
        position: absolute;
        left: calc(100% + 6px);
        top: 50%;
        translate: 0 -50%;
        display: grid;
        place-items: center;
        width: 18px;
        height: 18px;
        padding: 0;
        border: 1px solid var(--rail-border, #b9ac99);
        border-radius: 50%;
        background: transparent;
        color: inherit;
        cursor: pointer;
    }
    .clear:hover {
        background: var(--rail-hover, #463e350c);
    }
    .clear:focus-visible {
        outline: 2px solid #bd865e;
        outline-offset: 1px;
    }
    .clear svg {
        width: 12px;
        height: 12px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2.5;
        stroke-linecap: round;
    }
    .route-focus.chosen {
        background: var(--rail-selected, #463e351f);
    }
    .train {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .route-color {
        width: 5px;
        height: 14px;
        border-radius: 2px;
    }
    .route-focus {
        font: inherit;
        cursor: pointer;
    }
    .route-focus:disabled {
        cursor: default;
    }
</style>
