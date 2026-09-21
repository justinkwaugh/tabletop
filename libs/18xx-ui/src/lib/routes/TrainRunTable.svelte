<script lang="ts">
    import type { MoneyFormat } from '../presentation/money.js'
    import type { OperatingResult, Train } from '@tabletop/18xx'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import { routeColor } from './routePresentation.js'

    let {
        money,
        result,
        trains,
        trainName,
        trainColors,
        onFocusRoute,
        label = 'Train income'
    }: {
        money: MoneyFormat
        result: OperatingResult
        trains: readonly Train[]
        trainName: (definitionId: string) => string
        trainColors: Readonly<Record<string, string>>
        onFocusRoute?: (trainId: string) => void
        label?: string
    } = $props()
</script>

<table aria-label={label}>
    <thead><tr><th scope="col">Train</th><th scope="col">Income</th></tr></thead>
    <tbody>
        {#each trains as train (train.id)}
            {@const index = result.routes.findIndex((route) => route.trainId === train.id)}
            {@const route = result.routes[index]}
            <tr data-route-train={train.id}>
                <td colspan="2"
                    ><button
                        class="route-focus"
                        disabled={!route || !onFocusRoute}
                        aria-label={`Show ${trainName(train.definitionId)} route for ${money(route?.revenue ?? 0)}`}
                        onclick={() => onFocusRoute?.(train.id)}
                        ><span class="train">
                            <span
                                class="route-color"
                                style:background={route ? routeColor(index) : '#b6afa5'}
                            ></span>
                            <TrainBadge
                                name={trainName(train.definitionId)}
                                color={trainColors[train.definitionId]}
                            />
                        </span><span class="income">{money(route?.revenue ?? 0)}</span></button
                    ></td
                >
            </tr>
        {:else}<tr><td colspan="2">No trains</td></tr>{/each}
    </tbody>
    <tfoot
        ><tr
            ><th scope="row">Total</th><td class="income"
                >{money(result.revenue)}</td
            ></tr
        ></tfoot
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
