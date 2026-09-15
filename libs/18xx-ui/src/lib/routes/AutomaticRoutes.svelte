<script lang="ts">
    import { untrack } from 'svelte'
    import { FinanceExampleValidator } from '@tabletop/18xx'
    import { assert } from '@tabletop/common'
    import type { AutoroutingRequest, AutoroutingResponse } from '@tabletop/18xx-autorouter'
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'
    import TrainRunTable from './TrainRunTable.svelte'

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
        <TrainRunTable {result} {trains} {trainColors} {onFocusRoute}
            trainName={(id) => session.trainDepot.trainDefinition(id).name} />
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
