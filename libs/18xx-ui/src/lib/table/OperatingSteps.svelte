<script lang="ts">
    import { ActionSource } from '@tabletop/common'
    import { isFinishTrack, isFinishStations, isRunTrains } from '@tabletop/18xx' 
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'
    let { session, privatePurchaseLabel = 'Buy privates' }: { session: FinanceExampleSession; privatePurchaseLabel?: string } = $props()
    const steps = ['Track', 'Station', 'Run', 'Payout', 'Trains']
    const statuses = $derived.by(() => {
        const state = session.financialState
        const actions = session.actions.slice(0, session.gameState.actionCount)
        const boundary = actions.findLastIndex((action) => action.type === 'FinishOperatingTurn' || action.type === 'StartOperatingRound')
        const current = actions.slice(boundary + 1)
        const track = current.findLast(isFinishTrack)
        const station = current.findLast(isFinishStations)
        const run = current.findLast(isRunTrains)
        const distribution = state.earningsDistribution
        const purchased = state.trainPurchaseStep?.purchasedTrainIds.length ?? 0
        return [
            state.trackStep?.lays.length ? `${state.trackStep.lays.length} laid` :
                state.trackStep?.completed && track?.companyId === state.trackStep.companyId
                    ? track.source === ActionSource.System ? 'Not available' : 'Skipped' : undefined,
            state.stationStep?.placedStationIds.length ? 'Placed' :
                state.stationStep?.completed && station?.companyId === state.stationStep.companyId
                    ? station.source === ActionSource.System ? 'Not available' : 'Skipped' : undefined,
            state.routeStep?.result?.routes.length ? `Ran for $${state.routeStep.result.revenue.toLocaleString('en-US')}` :
                state.routeStep?.result && run?.companyId === state.routeStep.companyId
                    ? run.source === ActionSource.System ? 'Not available' : 'Skipped' : undefined,
            distribution ? distribution.choice === 'pay' ? 'Paid out' : distribution.choice === 'half-pay' ? 'Half-paid' : 'Withheld' : undefined,
            purchased ? `${purchased} bought` : undefined
        ]
    })

</script>

{#if session.operatingStep !== undefined}
<nav aria-label="Operating steps"
    style:--start-color={session.operatingStep === 0 ? '#695543' : '#ded0c2'}
    style:--end-color={session.operatingStep === 4 ? '#695543' : '#e8ded4'}>
    <div class="steps">
    {#each steps as step, index}
        <button class:current={index === session.operatingStep} class:completed={index < session.operatingStep}
            aria-current={index === session.operatingStep ? 'step' : undefined}
            disabled={!session.canSkipToOperatingStep(index)}
            title={session.canSkipToOperatingStep(index) ? (index === 1 ? 'Finish track and proceed to station placement' : 'Finish track and station placement, stopping for any required decision') : undefined}
            onclick={() => session.skipToOperatingStep(index)}>
            <span>{step}</span>
            {#if statuses[index]}<small>{statuses[index]}</small>{/if}
        </button>
    {/each}
    </div>
    {#if session.privatePurchases.length}
        <button class="buy-privates" aria-pressed={!!session.privatePurchaseSource}
            disabled={!session.canResolveCompanyDecision}
            onclick={() => session.choosePrivatePurchaseSource(
                session.privatePurchases.some((option) => option.request.seller.kind === 'player' &&
                    option.request.seller.playerId === session.myPlayer?.id) ? 'mine' : 'other'
            )}>{privatePurchaseLabel}</button>
    {/if}
</nav>
{/if}
<style>
    nav { display: flex; align-items: stretch; justify-content: center; padding: 0; border-bottom: 1px solid #cbbcad; flex: none; width: 100%; min-width: 0; container-type: inline-size; background: linear-gradient(to right, var(--start-color) 50%, var(--end-color) 50%); }
    .steps { display: flex; flex: 1; min-width: 0; justify-content: center; }
    button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; min-width: 0; flex: 0 1 110px; border: none; padding: 5px clamp(9px, 2cqi, 22px) 5px clamp(14px, 2.5cqi, 27px); margin-left: -11px; background: #e2d6ca; color: #685948; font: inherit; font-size: 12px; white-space: nowrap; cursor: pointer; clip-path: polygon(0 0, calc(100% - 11px) 0, 100% 50%, calc(100% - 11px) 100%, 0 100%, 11px 50%); }
    button > span { text-transform: uppercase; letter-spacing: 0.06em; }
    small { font-size: 9px; line-height: 1.1; font-weight: 400; }
    button:first-child { margin-left: 0; padding-left: 17px; clip-path: polygon(0 0, calc(100% - 11px) 0, 100% 50%, calc(100% - 11px) 100%, 0 100%); }
    button:last-child { padding-right: 17px; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 11px 50%); }
    @container (max-width: 420px) {
        button { font-size: 11px; padding-block: 4px; }
        small { font-size: 8px; letter-spacing: -0.02em; }
        button:first-child { padding-left: 4px; }
        button:last-child { padding-right: 4px; }
    }
    button:disabled { cursor: default; color: #968574; background: #e8ded4; }
    button.completed { color: #796856; background: #ded0c2; }
    button.current { background: #695543; color: #fffaf3; }
    button:not(:disabled):hover { background: #cdbba9; color: #443c34; }
    button:focus-visible { outline: none; background: #bda68f; color: #30291f; }
    button.buy-privates { flex: none; align-self: center; margin: 3px 8px; padding: 3px 10px; clip-path: none; border-radius: 4px; background: #ded0c2; color: #51412f; font-size: 12px; }
    button.buy-privates:hover:not(:disabled) { background: #cdbba9; }
    button.buy-privates[aria-pressed='true'] { background: #695543; color: #fffaf3; }
</style>
