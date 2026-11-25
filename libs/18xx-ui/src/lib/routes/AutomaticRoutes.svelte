<script lang="ts">
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import type { PendingRouteAnswer } from './routeSolveQueue.js'
    import { tableRouteSolver } from './tableRouteSolver.js'
    import { titleRunNames } from './routePresentation.js'
    import TrainRunTable from './TrainRunTable.svelte'
    import { RunStepTimeLimitMs } from '../session/routesModule.svelte.js'

    let {
        session,
        onFocusRoute,
        trainColors
    }: {
        session: EighteenXXSessionView
        onFocusRoute: (trainId: string) => void
        trainColors: Readonly<Record<string, string>>
    } = $props()
    const money = $derived(session.presentation.money)
    const runNames = $derived(titleRunNames(session.presentation))
    const solver = tableRouteSolver()
    let error = $state<string>()
    let attempt = $state(0)
    const routes = $derived(session.routes)
    const result = $derived(routes.shown)
    const trains = $derived(routes.editor.trains)
    const drawn = $derived(routes.editor.draft !== undefined)
    const chosenTrain = $derived(trains.find((train) => train.id === routes.editor.trainId))
    const target = $derived(
        routes.proven
            ? { label: 'Most possible', phrase: 'the most possible' }
            : { label: 'Best found', phrase: 'the best found' }
    )
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
        let pending: PendingRouteAnswer | undefined
        function start({ gameState, companyId }: RouteSolve) {
            pending?.cancel()
            pending = undefined
            if (!companyId || session.routes.solved) return
            error = undefined
            const asked = solver.ask({
                state: session.gameState.dehydrate(),
                companyId,
                timeLimitMs: RunStepTimeLimitMs
            })
            pending = asked
            void asked.answer.then((response) => {
                if (pending !== asked) return
                pending = undefined
                if (response.error !== undefined) {
                    error = response.error
                    return
                }
                try {
                    session.routes.setSolved(
                        gameState,
                        response.result.result,
                        response.result.exhaustive
                    )
                } catch (failure) {
                    error = failure instanceof Error ? failure.message : 'Route calculation failed.'
                }
            })
        }
        start(initial)
        return {
            update: start,
            destroy() {
                pending?.cancel()
                pending = undefined
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
            attachments={routes.editor.attachments}
            movableAttachments={routes.editable ? routes.editor.movableAttachments : []}
            onAttach={(attachmentId) => routes.attach(attachmentId)}
            {runNames}
            bonusName={(sourceId) => session.names.routeBonus(sourceId)}
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
        {:else if routes.reducedRun && !routes.reducedRun.allowed}<p class="note" role="alert">
                This run earns {money(routes.reducedRun.revenue)}; {target.phrase} is
                {money(routes.revenueToReach ?? 0)}.
                {#if routes.reducedRun.subsidyToBeat !== undefined}
                    <br />To run for less, it must bring more {runNames.subsidy} than
                    {money(routes.reducedRun.subsidyToBeat)}. It brings
                    {money(routes.reducedRun.subsidy)}.
                {/if}
            </p>
        {:else if routes.reducedRun}<p class="note">
                This run earns {money(routes.reducedRun.revenue)}, less than {target.phrase},
                {money(routes.revenueToReach ?? 0)}, and brings {runNames.subsidy} of
                {money(routes.reducedRun.subsidy)} instead of
                {money(routes.reducedRun.subsidyToBeat ?? 0)}.
            </p>
        {:else if chosenTrain}<small
                >Tap stops on the map to change the {session.trainDepot.trainDefinition(
                    chosenTrain.definitionId
                ).name} train’s route.</small
            >
        {:else if routes.editable && !drawn}<small>Tap a train to draw its route.</small>
        {/if}
        {#if drawn && routes.revenueToReach !== undefined && !routes.reducedRun}<small
                >{target.label}: {money(routes.revenueToReach)}.</small
            >{/if}
        {#if !drawn && !routes.proven}<small>Best routes found within the search time.</small>{/if}
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
        color: var(--rail-solid-text, #fff);
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
