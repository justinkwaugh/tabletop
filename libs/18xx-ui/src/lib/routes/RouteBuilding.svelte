<script lang="ts">
    import type { OperatingResult, RouteResult } from '@tabletop/18xx'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    let {
        session,
        recordedResult,
        showUndo = true
    }: {
        showUndo?: boolean
        recordedResult?: OperatingResult
        session: Pick<
            EighteenXXSessionView,
            'undo' | 'busy' | 'isViewingHistory' | 'companyName' | 'placeName'
        > & {
            gameState: Pick<EighteenXXSessionView['gameState'], 'routeStep' | 'companies'>
            presentation: Pick<EighteenXXSessionView['presentation'], 'money'>
            routes: Pick<
                EighteenXXSessionView['routes'],
                | 'editor'
                | 'editable'
                | 'shown'
                | 'drawnReason'
                | 'submission'
                | 'selectTrain'
                | 'run'
            >
        }
    } = $props()
    const money = $derived(session.presentation.money)
    function breakdown(route: RouteResult): string {
        return [
            ...route.payments.map(
                (payment) => `${session.placeName(payment.locationId)}: ${money(payment.amount)}`
            ),
            ...(route.bonuses ?? []).map(
                (bonus) => `${session.placeName(bonus.locationId)} bonus: ${money(bonus.amount)}`
            )
        ].join(' + ')
    }
    const editor = $derived(session.routes.editor)
    const step = $derived(
        recordedResult
            ? { companyId: recordedResult.companyId, result: recordedResult }
            : session.gameState.routeStep
    )
    const result = $derived(step?.result ?? session.routes.shown)
</script>

{#if step}
    <section aria-label="Train routes" class="routes">
        <header>
            <h3>
                {session.companyName(step.companyId)} · Routes
            </h3>
            {#if showUndo}<button
                    onclick={() => session.undo()}
                    disabled={session.busy || session.isViewingHistory}>Undo</button
                >{/if}
            {#if result}<strong>Revenue: {money(result.revenue)}</strong>{/if}
        </header>
        {#if !step.result && session.routes.editable}
            <div class="trains" aria-label="Route trains">
                {#each editor.trains as train (train.id)}
                    <button
                        onclick={() => session.routes.selectTrain(train.id)}
                        aria-pressed={editor.trainId === train.id}
                        >Draw {editor.rules.depot.trainDefinition(train.definitionId).name} ({train.id})</button
                    >
                {/each}
            </div>
        {/if}
        <div aria-label="Route results">
            {#each result?.routes ?? [] as route (route.trainId)}<div
                    class="result"
                    data-route-train={route.trainId}
                >
                    <strong
                        >{editor.rules.depot.trainDefinition(route.definitionId).name}: {money(
                            route.revenue
                        )}</strong
                    >
                    <span>{breakdown(route)}</span>
                </div>{/each}
        </div>
        {#if !step.result}
            {#if session.routes.drawnReason}<p role="alert">{session.routes.drawnReason}</p>{/if}
            <footer>
                <button disabled={!session.routes.submission} onclick={() => session.routes.run()}
                    >Run trains</button
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
    button {
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
    p {
        margin: 10px 0;
    }
    [role='alert'] {
        color: #a3261c;
    }
</style>
