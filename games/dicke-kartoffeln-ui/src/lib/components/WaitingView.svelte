<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeOutcome } from '$lib/utils/describe.js'
    import { stepDescription } from '$lib/utils/history.js'
    import { roundLabel } from '$lib/utils/rounds.js'
    import { YearEndStatus, isYearEndAction } from '$lib/utils/yearEnd.js'
    import DescriptionText from './Description.svelte'
    import YearEndReport from './YearEndReport.svelte'

    const gameSession = getGameSession()

    const LIVE_LINES = 6
    const step = $derived(
        stepDescription(gameSession.actions, gameSession.gameState.marketBoard())
    )
    const lines = $derived(gameSession.isViewingHistory ? step : step.slice(-LIVE_LINES))
    const waiting = $derived(gameSession.gameState.activePlayerIds)
    const label = $derived(roundLabel(gameSession.gameState.machineState))
    const sealed = $derived(gameSession.sealedPlan)

    const yearEnd = $derived(
        gameSession.currentAction && isYearEndAction(gameSession.currentAction)
            ? gameSession.yearEnd
            : undefined
    )
    const yearEndStep = $derived(
        yearEnd?.phases.findLastIndex((phase) => phase.status === YearEndStatus.Resolved) ?? 0
    )
</script>

<div class="waiting">
    {#if !gameSession.isViewingHistory && waiting.length > 0 && label}
        <div class="next">
            {#each waiting as playerId, index (playerId)}
                {#if index > 0}<span>,</span>{/if}
                <PlayerName {playerId} />
            {/each}
            <span>{waiting.length === 1 ? 'is' : 'are'} deciding: {label.name.toLowerCase()}</span>
        </div>
        {#if sealed && gameSession.myPlayerId}
            <div class="sealed">
                Your plan is sealed:
                <DescriptionText
                    description={describeOutcome({
                        playerId: gameSession.myPlayerId,
                        plan: sealed,
                        cost: 0,
                        income: 0,
                        loansTaken: 0
                    }).slice(1)}
                />
            </div>
        {/if}
    {/if}
    {#if yearEnd}
        <div class="year-end"><YearEndReport report={yearEnd} step={yearEndStep} /></div>
    {:else}
        {#each lines as line, index (index)}
            <div class="last"><DescriptionText description={line} /></div>
        {/each}
    {/if}
</div>

<style>
    .waiting {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 6px 12px;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        text-transform: uppercase;
        color: #3d2410;
        text-align: center;
    }

    .next,
    .sealed,
    .last {
        display: inline-flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 4px;
    }

    .next {
        font-size: 18px;
    }

    .sealed {
        color: #1b3c8c;
        font-size: 16px;
    }

    .year-end {
        align-self: stretch;
        text-align: left;
    }

    .last {
        font-size: 15px;
        color: #5a4026;
    }
</style>
