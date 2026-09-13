<script lang="ts">
    import { untrack } from 'svelte'
    import { FinanceExampleValidator } from '@tabletop/18xx'
    import { assert } from '@tabletop/common'
    import type { AutoroutingRequest, AutoroutingResponse } from '@tabletop/18xx-autorouter'
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import { routeColor } from './routePresentation.js'

    let {
        session,
        createRouteWorker,
        onFocusRoute,
        trainColors
    }: {
        session: FinanceExampleSession
        createRouteWorker: () => Worker
        onFocusRoute: (trainId: string) => void
        trainColors: Readonly<Record<string, string>>
    } = $props()
    let error = $state<string>()
    let attempt = $state(0)
    const result = $derived(session.automaticRouteResult?.result)
    const trains = $derived(session.routeEditor.trains)
    $effect(() => {
        const state = session.financialState
        const companyId = state.routeStep?.companyId
        const canRun = session.canRunTrains
        void attempt
        if (!canRun || !companyId || untrack(() => session.automaticRouteResult)) return
        error = undefined
        let cancelled = false
        let worker: Worker | undefined
        try {
            worker = createRouteWorker()
            worker.onmessage = (event: MessageEvent<AutoroutingResponse>) => {
                if (cancelled) return
                if (event.data.error !== undefined) error = event.data.error
                else {
                    try {
                        session.setAutomaticRoutes(
                            state,
                            event.data.result.result,
                            event.data.result.exhaustive
                        )
                    } catch (failure) {
                        error =
                            failure instanceof Error ? failure.message : 'Route calculation failed.'
                    }
                }
                worker?.terminate()
            }
            worker.onerror = () => {
                if (!cancelled) error = 'The route solver could not finish. Please try again.'
                worker?.terminate()
            }
            const snapshot = session.gameState.dehydrate()
            assert(
                FinanceExampleValidator.Check(snapshot),
                'Autorouting requires complete game state'
            )
            const request: AutoroutingRequest = { state: snapshot, companyId }
            worker.postMessage(request)
        } catch (failure) {
            worker?.terminate()
            error = failure instanceof Error ? failure.message : 'The route solver could not start.'
        }
        return () => {
            cancelled = true
            worker?.terminate()
        }
    })
</script>

<section aria-label="Run trains" class="automatic-routes">
    {#if error}
        <p role="alert">{error}</p>
        <button disabled={!session.canRunTrains} onclick={() => attempt++}>Try again</button>
    {:else if !result}
        <p role="status">
            {session.isViewingHistory ? 'Viewing train run' : 'Calculating routes…'}
        </p>
    {:else}
        <table aria-label="Train income">
            <thead><tr><th scope="col">Train</th><th scope="col">Income</th></tr></thead>
            <tbody>
                {#each trains as train (train.id)}
                    {@const index = result.routes.findIndex((route) => route.trainId === train.id)}
                    {@const route = result.routes[index]}
                    <tr data-route-train={train.id}>
                        <td
                            ><button
                                class="route-focus"
                                disabled={!route}
                                aria-label={`Show ${session.trainDepot.trainDefinition(train.definitionId).name} route for $${route?.revenue ?? 0}`}
                                onclick={() => onFocusRoute(train.id)}
                                ><span class="train">
                                    <span
                                        class="route-color"
                                        style:background={route ? routeColor(index) : '#b6afa5'}
                                    ></span>
                                    <TrainBadge
                                        name={session.trainDepot.trainDefinition(train.definitionId)
                                            .name}
                                        color={trainColors[train.definitionId]}
                                    />
                                </span></button
                            ></td
                        >
                        <td class="income">${(route?.revenue ?? 0).toLocaleString('en-US')}</td>
                    </tr>
                {:else}<tr><td colspan="2">No trains</td></tr>{/each}
            </tbody>
            <tfoot
                ><tr
                    ><th scope="row">Total</th><td class="income"
                        >${result.revenue.toLocaleString('en-US')}</td
                    ></tr
                ></tfoot
            >
        </table>
        <button
            class="run"
            disabled={!session.canRunTrains}
            onclick={() => session.runAutomaticTrains()}>Run trains</button
        >
        {#if !session.automaticRouteResult?.exhaustive}<small
                >Best routes found within the search time.</small
            >{/if}
    {/if}
</section>

<style>
    .automatic-routes {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 12px 24px;
        padding: 10px 12px;
        color: #463e35;
    }
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
        color: #817565;
        font-size: 10px;
        font-weight: 600;
        line-height: 14px;
    }
    tfoot th,
    tfoot td {
        border-top: 1px solid #d6cbbc;
        padding-top: 3px;
        font-weight: 650;
    }
    tbody tr {
        position: relative;
    }
    .route-focus {
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        color: inherit;
    }
    .route-focus::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 3px;
    }
    .route-focus:not(:disabled):hover::after {
        background: #463e350c;
    }
    .route-focus:focus-visible {
        outline: none;
    }
    .route-focus:focus-visible::after {
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
    button {
        border: 1px solid #b9ac99;
        border-radius: 5px;
        padding: 7px 14px;
        font: inherit;
        cursor: pointer;
    }
    .run {
        color: #fff;
        background: #443e35;
        border-color: #443e35;
    }
    button:disabled {
        opacity: 0.5;
        cursor: default;
    }
    button:focus-visible {
        outline: 2px solid #bd865e;
        outline-offset: 2px;
    }
    p {
        margin: 0;
    }
    small {
        flex-basis: 100%;
        text-align: center;
        color: #817565;
    }
</style>
