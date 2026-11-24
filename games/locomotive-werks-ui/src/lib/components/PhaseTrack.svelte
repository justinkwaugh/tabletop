<script lang="ts">
    import { PhaseName } from '@tabletop/locomotive-werks'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { ReviewStage, type RoundReview } from '$lib/model/session.svelte.js'

    // The round's sequence of play, with the phase in progress picked out. During a round review it
    // follows the phase being reviewed in the round that ended.
    let { review }: { review?: RoundReview } = $props()

    const gameSession = getGameSession()

    const REVIEWED_PHASE: Record<ReviewStage, PhaseName> = {
        [ReviewStage.Production]: PhaseName.Production,
        [ReviewStage.Taxes]: PhaseName.Taxes,
        [ReviewStage.MarketDemands]: PhaseName.MarketDemands
    }

    const state = $derived(gameSession.gameState)
    const current = $derived(
        review ? REVIEWED_PHASE[gameSession.reviewStage] : state.phaseManager.currentPhase?.name
    )
    const roundNumber = $derived(review ? review.round : state.round())
    const phases = $derived([
        { name: PhaseName.Development, label: 'Development' },
        gameSession.buyAndShip
            ? { name: PhaseName.CapacityAndFirstShipment, label: 'Capacity & First Shipment' }
            : { name: PhaseName.ProductionCapacity, label: 'Production Capacity' },
        { name: PhaseName.Production, label: 'Production' },
        { name: PhaseName.Taxes, label: 'Taxes' },
        { name: PhaseName.MarketDemands, label: 'Market Demands' }
    ])
    const sellingRound = $derived(
        !review && state.sellingRound && state.sellingRound.number > 1
            ? `selling round ${state.sellingRound.number}`
            : undefined
    )
</script>

<div class="track">
    <span class="round">{state.result ? 'Game over' : `Round ${roundNumber}`}</span>
    <ol aria-label="Sequence of play">
        {#each phases as phase (phase.name)}
            {@const active = !state.result && phase.name === current}
            <li class:active aria-current={active ? 'step' : undefined}>
                {phase.label}{#if active && sellingRound}<span class="sub">
                        · {sellingRound}</span
                    >{/if}
            </li>
        {/each}
    </ol>
</div>

<style>
    .track {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 4px 8px;
        font-family: 'LW Baskerville', Georgia, serif;
    }

    .round {
        font-size: 11.5px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #232d36;
    }

    ol {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 3px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    li {
        border: 1.5px solid #a7b8c5;
        border-radius: 999px;
        padding: 1px 9px;
        color: #627688;
        font-size: 11.5px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        white-space: nowrap;
    }

    @media (max-width: 639px) {
        .round,
        li {
            padding: 0 6px;
            font-size: 9.5px;
            letter-spacing: 0.03em;
        }
    }

    li.active {
        border-color: #25303a;
        background: #25303a;
        color: #e9eef2;
    }

    .sub {
        font-weight: 400;
        letter-spacing: 0.02em;
        text-transform: none;
    }
</style>
