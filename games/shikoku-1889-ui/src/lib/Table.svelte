<script lang="ts">
    import { Shikoku1889PhaseChart } from './phaseChart.js'
    import { Shikoku1889TrackColors } from '@tabletop/shikoku-1889'
    import { Shikoku1889CompanyNames } from './companyPresentation.js'
    import { Shikoku1889EndingRules } from '@tabletop/shikoku-1889'
    import { Shikoku1889TrainColors } from './trainPresentation.js'
    import { Shikoku1889OperatingRules } from '@tabletop/shikoku-1889'
    import OpeningAuction from './OpeningAuction.svelte'
    import type { GameSession } from '@tabletop/frontend-components'
    import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'
    import { GameTable, OperatingActions, requireEighteenXXSession } from '@tabletop/18xx-ui'
    function createRouteWorker() {
        return new Worker(new URL('./autorouter.worker.js', import.meta.url), { type: 'module' })
    }
    let { gameSession }: { gameSession: GameSession<EighteenXXState, HydratedEighteenXXState> } = $props()
    const session = $derived(requireEighteenXXSession(gameSession))
    const privateOperationDescription = (id: string) =>
        id === 'SRR'
            ? 'Ignores mountain-only terrain costs. Combined river and mountain costs still apply.'
            : id === 'ER' && !session.financialState.usedPrivatePowerIds.includes(id)
              ? 'On purchase, the seller may immediately upgrade Ohzu in addition to ordinary construction.'
              : undefined
</script>

<GameTable
    phaseChart={Shikoku1889PhaseChart}
    companyNames={Shikoku1889CompanyNames}
    marketPoolId="open-market"
    {session}
    valuationRules={Shikoku1889EndingRules}
    trainColors={Shikoku1889TrainColors}
    phaseColors={Shikoku1889TrainColors}
    phaseTileColors={Shikoku1889TrackColors}
    operatingRules={Shikoku1889OperatingRules}
    {privateOperationDescription}
>
    {#snippet actions(_focusLocation, focusRoute)}
        {#if session.waterfall.model && !session.waterfall.model.auction.completed}
            <OpeningAuction {session} showUndo={false} />
        {:else}
            <OperatingActions privateTilePrompts={{ MF: 'Place the port tile', ER: 'Place a tile in Ohzu' }} {privateOperationDescription} onFocusRoute={focusRoute} {session} {createRouteWorker} trainColors={Shikoku1889TrainColors} />
        {/if}
    {/snippet}
</GameTable>
