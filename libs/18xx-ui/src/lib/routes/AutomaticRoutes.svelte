<script lang="ts">
    import type { AutoroutingRequest, AutoroutingResponse } from '@tabletop/18xx-autorouter'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import TrainRunTable from './TrainRunTable.svelte'

    let {
        session,
        createRouteWorker,
        onFocusRoute,
        trainColors
    }: {
        session: EighteenXXSessionView
        createRouteWorker: () => Worker
        onFocusRoute: (trainId: string) => void
        trainColors: Readonly<Record<string, string>>
    } = $props()
    const money = $derived(session.presentation.money)
    let error = $state<string>()
    let attempt = $state(0)
    const routes = $derived(session.routes)
    const result = $derived(routes.shown)
    const trains = $derived(routes.editor.trains)
    const drawn = $derived(routes.editor.draft !== undefined)
    const chosenTrain = $derived(trains.find((train) => train.id === routes.editor.trainId))
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
            onChooseTrain={routes.editable ? (trainId) => routes.selectTrain(trainId) : undefined}
            onClearTrain={routes.editor.draft?.routes.some(
                (route) => route.trainId === routes.editor.trainId
            )
                ? () => routes.clearTrain()
                : undefined}
            chosenTrainId={routes.editor.trainId}
            trainName={(id) => session.trainDepot.trainDefinition(id).name}
        />
        <span class="buttons">
            {#if drawn}<button
                    title="Run the best routes found"
                    disabled={!routes.canRun}
                    onclick={() => routes.useBestRun()}>Auto</button
                >{/if}
            <button class="run" disabled={!routes.submission} onclick={() => routes.run()}
                >Run trains</button
            >
        </span>
        {#if routes.drawnReason}<p class="note" role="alert">{routes.drawnReason}</p>
        {:else if chosenTrain}<small
                >Tap stops on the map to change the {session.trainDepot.trainDefinition(
                    chosenTrain.definitionId
                ).name} train’s route.</small
            >
        {:else if routes.editable && !drawn}<small>Tap a train to draw its route.</small>
        {/if}
        {#if !drawn && !routes.solved?.exhaustive}<small
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
    .buttons {
        display: flex;
        gap: 8px;
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
    small,
    .note {
        flex-basis: 100%;
        text-align: center;
        color: var(--rail-muted, #817565);
    }
    .note {
        color: inherit;
    }
</style>
