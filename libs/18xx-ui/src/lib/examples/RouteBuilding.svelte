<script lang="ts">
    import type { FinanceExampleSession } from './financeExampleSession.svelte.js'
    let { session, showUndo = true }: { showUndo?: boolean; session: FinanceExampleSession } =
        $props()
    const editor = $derived(session.routeEditor)
    const step = $derived(session.financialState.routeStep)
    const visible = $derived(session.routeDraftVisible)
    const current = $derived(visible ? editor.route : undefined)
    const preview = $derived(visible ? editor.preview : undefined)
    const evaluation = $derived(visible ? editor.combinedPreview : undefined)
    const results = $derived(
        step?.result?.routes ??
            (visible
                ? editor.routes.flatMap((route) => {
                      const result = editor.evaluation.evaluateRoute(step!.companyId, route).result
                      return result ? [result] : []
                  })
                : [])
    )
</script>

{#if step}
    <section aria-label="Train routes" class="routes">
        <header>
            <h3>
                {session.financialState.companies.find((company) => company.id === step.companyId)
                    ?.name} · Routes
            </h3>
            {#if showUndo}<button
                    onclick={() => session.undo()}
                    disabled={session.busy || session.isViewingHistory}>Undo</button
                >{/if}
            {#if step.result}<strong>Revenue: ${step.result.revenue}</strong>{/if}
        </header>
        {#if !step.result}
            <div class="trains" aria-label="Route trains">
                {#each editor.trains as train}
                    <button
                        disabled={!session.canRunTrains ||
                            (visible && editor.routes.some((route) => route.trainId === train.id))}
                        onclick={() => session.selectRouteTrain(train.id)}
                        aria-pressed={visible && editor.trainId === train.id}
                        >Run {editor.rules.depot.trainDefinition(train.definitionId).name} ({train.id})</button
                    >
                {/each}
            </div>
            {#if visible && editor.trainId}
                <div aria-label="Route draft" class="draft">
                    <label
                        >Starting revenue center
                        <select
                            aria-label="Starting revenue center"
                            value={editor.start ? JSON.stringify(editor.start) : ''}
                            disabled={!session.canRunTrains}
                            onchange={(event) => {
                                const center = editor.centers.find(
                                    (center) => JSON.stringify(center) === event.currentTarget.value
                                )
                                if (center) session.selectRouteStart(center)
                            }}
                        >
                            <option value="" disabled>Choose a center</option>
                            {#each editor.centers as center}<option value={JSON.stringify(center)}
                                    >{editor.rules.map.location(center.locationId).name ??
                                        center.locationId} · {center.locationId}
                                    {center.nodeId}</option
                                >{/each}
                        </select>
                    </label>
                    {#if editor.start}
                        <p>
                            Path: {editor.start.locationId}
                            {editor.start.nodeId}{#each editor.paths as path}
                                → {path.locationId} {path.pathId}{/each}
                        </p>
                        <div class="extensions" aria-label="Next track">
                            {#each editor.extensions as path}<button
                                    disabled={!session.canRunTrains}
                                    onclick={() => session.appendRoutePath(path)}
                                    >Add {path.locationId} {path.pathId}</button
                                >{/each}
                        </div>
                    {/if}
                    {#if preview?.reason}<p role="status">{preview.reason}</p>{/if}
                    {#if preview?.result}<p>
                            Distance: {preview.result.distance} · Revenue: ${preview.result.revenue}
                        </p>
                        <p>
                            {preview.result.payments
                                .map((payment) => `${payment.locationId}: $${payment.amount}`)
                                .join(' + ')}
                        </p>{/if}
                    <button disabled={!session.canRunTrains} onclick={() => session.backRoute()}
                        >Back</button
                    >
                    <button
                        disabled={!session.canRunTrains || !preview?.result}
                        onclick={() => session.saveRoute()}>Save route</button
                    >
                </div>
            {/if}
        {/if}
        <div aria-label="Route results">
            {#each results as route}<div class="result" data-route-train={route.trainId}>
                    <strong
                        >{editor.rules.depot.trainDefinition(
                            editor.state.trainInventory.trains.find(
                                (train) => train.id === route.trainId
                            )!.definitionId
                        ).name}: ${route.revenue}</strong
                    >
                    <span
                        >{route.payments
                            .map((payment) => `${payment.locationId}: $${payment.amount}`)
                            .join(' + ')}</span
                    >
                    {#if !step.result}<button
                            disabled={!session.canRunTrains || Boolean(editor.trainId)}
                            onclick={() => session.editRoute(route.trainId)}>Edit route</button
                        ><button
                            disabled={!session.canRunTrains}
                            onclick={() => session.removeRoute(route.trainId)}>Remove route</button
                        >{/if}
                </div>{/each}
        </div>
        {#if !step.result}
            {#if evaluation?.reason}<p role="alert">{evaluation.reason}</p>{/if}
            <footer>
                <strong>Revenue: ${evaluation?.result?.revenue ?? 0}</strong>
                <button
                    disabled={!session.canRunTrains ||
                        Boolean(editor.trainId) ||
                        !editor.submission?.result}
                    onclick={() => session.confirmRoutes()}>Confirm routes</button
                >
            </footer>
        {/if}
    </section>
{/if}

<style>
    .routes {
        border: 1px solid var(--rail-border, #c9d2cb);
        padding: 12px;
        margin-bottom: 14px;
        border-radius: 6px;
    }
    header,
    .trains,
    .extensions,
    .result,
    footer {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
        margin: 8px 0;
    }
    h3 {
        margin: 0 12px 0 0;
        font-size: 16px;
    }
    button,
    select {
        font: inherit;
        padding: 7px 10px;
        border: 1px solid var(--rail-border, #b5c3ba);
        border-radius: 5px;
        background: var(--rail-surface, #fffefa);
    }
    button {
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
    button[aria-pressed='true'] {
        outline: 2px solid #d58400;
    }
    .draft {
        padding: 12px;
        border: 1px dashed #d58400;
        margin: 12px 0;
    }
    label {
        display: flex;
        gap: 8px;
        align-items: center;
    }
    p {
        margin: 10px 0;
    }
    [role='alert'] {
        color: #a3261c;
    }
</style>
