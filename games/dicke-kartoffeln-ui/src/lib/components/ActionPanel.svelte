<script lang="ts">
    import { LOAN_AMOUNT, PlanKind, VARIETIES } from '@tabletop/dicke-kartoffeln'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { marks } from '$lib/utils/format.js'
    import WaitingView from './WaitingView.svelte'
    import YearEndReport from './YearEndReport.svelte'

    const gameSession = getGameSession()

    const preview = $derived(gameSession.preview)
    const kind = $derived(gameSession.planKind)
    const empty = $derived(preview ? gameSession.edits.length === 0 : true)
    const seedPrices = $derived(
        VARIETIES.map((variety) => `${variety} ${gameSession.seedPrice(variety)}`).join(', ')
    )
    const ripe = $derived(gameSession.myPlayerState?.ripeCompost ?? 0)
</script>

{#if gameSession.pendingYearEnd}
    <YearEndReport report={gameSession.pendingYearEnd} step={gameSession.yearEndStep} stepping />
{:else if preview && kind}
    <div class="panel">
        <p class="prompt">
            {#if kind === PlanKind.TakeCompost}
                Click a field to move one of its worms to compost pile 1. Each field you take from
                costs 100 marks; the worms double in time for next autumn.
            {:else if kind === PlanKind.Cultivate}
                Click the fields you want to plough. A furrow costs 40 marks.
            {:else if kind === PlanKind.Sow}
                Circle A, B or C on your yield sheet, or click a ploughed field, to sow it. Seed
                costs the Norm price: {seedPrices} marks.
            {:else if kind === PlanKind.Fertilize}
                Write an F on your yield sheet, or click a sown field, to fertilize it: 100 marks a
                sack, two sacks on a field with a skull. It kills sunflowers and leaves a skull.
            {:else if kind === PlanKind.Spray}
                Click a sown field to spray it against pests (100 marks). It kills sunflowers and
                leaves a skull.
            {:else if kind === PlanKind.RegisterSales}
                Enter on your yield sheet how many sacks of each field you offer. Harvesting a field
                you sell from costs 100 marks; only fields with three sunflowers sell Bio.
            {:else if kind === PlanKind.SpreadCompost}
                Click your fields to spread worms from compost pile 2 (100 marks per field, at most
                5 worms a field). Worms left over go to the bank at 60 marks each:
                {ripe - gameSession.wormsSpread} of {ripe}.
            {/if}
        </p>
        <div class="footer">
            <span class="money">
                {#if preview.cost > 0}costs {marks(preview.cost)}{/if}
                {#if preview.income > 0}{preview.cost > 0 ? ' · ' : ''}earns {marks(
                        preview.income
                    )}{/if}
                {#if preview.loans > 0}
                    <span class="loan">· needs a loan of {marks(preview.loans * LOAN_AMOUNT)}</span>
                {/if}
                {#if preview.problem}<span class="problem">{preview.problem}</span>{/if}
            </span>
            {#if kind === PlanKind.RegisterSales}
                <button
                    type="button"
                    class="all"
                    disabled={gameSession.offeringAll}
                    onclick={() => gameSession.offerAll()}>Offer all my sacks</button
                >
            {/if}
            <button
                type="button"
                class="seal"
                disabled={preview.problem !== undefined}
                onclick={() => gameSession.submitPlan()}
            >
                {empty ? 'Do nothing this round' : 'Seal my plan'}
            </button>
        </div>
    </div>
{:else}
    <WaitingView />
{/if}

<style>
    .panel {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 6px 12px;
        font-family: 'Kartoffeln Typewriter', 'Courier New', monospace;
        color: #3d2410;
    }

    .prompt {
        margin: 0;
        font-size: 17px;
        line-height: 1.25;
    }

    .footer {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }

    .money {
        flex: 1;
        font-size: 17px;
    }

    .all {
        border: 2px solid #6e3b1c;
        border-radius: 999px;
        padding: 1px 14px;
        color: #6e3b1c;
        font-size: 17px;
    }

    .all:hover {
        background: rgba(110, 59, 28, 0.12);
    }

    .all:disabled {
        opacity: 0.4;
    }

    .loan {
        color: #8a1d1d;
    }

    .problem {
        margin-left: 8px;
        color: #b42318;
    }

    .seal {
        border-radius: 999px;
        background: #6e3b1c;
        padding: 3px 18px;
        color: #fff6dc;
        font-size: 18px;
    }

    .seal:hover {
        background: #8a4b25;
    }

    .seal:disabled {
        opacity: 0.4;
    }

    @media (max-width: 639px) {
        .prompt,
        .money {
            font-size: 14px;
        }
    }
</style>
