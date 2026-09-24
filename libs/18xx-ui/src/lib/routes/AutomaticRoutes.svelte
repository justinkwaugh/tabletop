<script lang="ts">
    import type { AutoroutingRequest, AutoroutingResponse } from '@tabletop/18xx-autorouter'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    import TrainRunTable from './TrainRunTable.svelte'

    let {
        session,
        createRouteWorker,
        onFocusRoute,
        trainColors
    }: {
        session: EighteenXXSession
        createRouteWorker: () => Worker
        onFocusRoute: (trainId: string) => void
        trainColors: Readonly<Record<string, string>>
    } = $props()
    const money = $derived(session.presentation.money)
    let error = $state<string>()
    let attempt = $state(0)
    const result = $derived(session.routes.solved?.result)
    const trains = $derived(session.routes.editor.trains)
    type RouteSolve = {
        gameState: typeof session.gameState
        companyId: string | undefined
        attempt: number
    }
    const solve = $derived<RouteSolve>({
        gameState: session.gameState,
        companyId: session.routes.canRun ? session.gameState.routeStep?.companyId : undefined,
        attempt
    })
    function solveRoutes(_section: HTMLElement, initial: RouteSolve) {
        let worker: Worker | undefined
        function start({ gameState, companyId }: RouteSolve) {
            worker?.terminate()
            worker = undefined
            if (!companyId || session.routes.solved) return
            error = undefined
            try {
                const solver = createRouteWorker()
                worker = solver
                solver.onmessage = (event: MessageEvent<AutoroutingResponse>) => {
                    if (worker !== solver) return
                    if (event.data.error !== undefined) error = event.data.error
                    else {
                        try {
                            session.routes.setSolved(
                                gameState,
                                event.data.result.result,
                                event.data.result.exhaustive
                            )
                        } catch (failure) {
                            error =
                                failure instanceof Error
                                    ? failure.message
                                    : 'Route calculation failed.'
                        }
                    }
                    solver.terminate()
                }
                solver.onerror = () => {
                    if (worker === solver)
                        error = 'The route solver could not finish. Please try again.'
                    solver.terminate()
                }
                const request: AutoroutingRequest = {
                    state: session.gameState.dehydrate(),
                    companyId
                }
                solver.postMessage(request)
            } catch (failure) {
                worker?.terminate()
                worker = undefined
                error =
                    failure instanceof Error ? failure.message : 'The route solver could not start.'
            }
        }
        start(initial)
        return {
            update: start,
            destroy() {
                worker?.terminate()
                worker = undefined
            }
        }
    }
</script>

<section aria-label="Run trains" class="automatic-routes" use:solveRoutes={solve}>
    {#if error}
        <p role="alert">{error}</p>
        <button disabled={!session.routes.canRun} onclick={() => attempt++}>Try again</button>
    {:else if !result}
        <p role="status">
            {session.isViewingHistory ? 'Viewing train run' : 'Calculating routes…'}
        </p>
    {:else}
        <TrainRunTable
            {money}
            {result}
            {trains}
            {trainColors}
            {onFocusRoute}
            trainName={(id) => session.trainDepot.trainDefinition(id).name}
        />
        <button
            class="run"
            disabled={!session.routes.canRun}
            onclick={() => session.routes.runSolved()}>Run trains</button
        >
        {#if !session.routes.solved?.exhaustive}<small
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
        color: var(--rail-text, #463e35);
    }
    button {
        border: 1px solid var(--rail-border, #b9ac99);
        border-radius: 5px;
        padding: 7px 14px;
        font: inherit;
        cursor: pointer;
    }
    .run {
        color: #fff;
        background: var(--rail-solid, #443e35);
        border-color: var(--rail-focus, #443e35);
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
        color: var(--rail-muted, #817565);
    }
</style>
