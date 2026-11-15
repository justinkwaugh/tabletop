<script lang="ts" module>
    import type { IgnorableStockInstructionStop } from '@tabletop/18xx'

    export type StopChoice = {
        intro: string
        ignoredStops: readonly IgnorableStockInstructionStop[]
        change: (ignoredStops: IgnorableStockInstructionStop[]) => void
    }
</script>

<script lang="ts">
    import { ignorableStockInstructionStops, toggledMember } from '@tabletop/18xx'
    import StopList from '../table/StopList.svelte'
    import {
        goalStopCondition,
        ignorableStopCondition,
        limitStopCondition
    } from './stockInstructionText.js'

    let { choice, disabled }: { choice: StopChoice | undefined; disabled: boolean } = $props()

    const switches = $derived(
        ignorableStockInstructionStops.map((stop) => ({
            key: stop,
            label: ignorableStopCondition[stop],
            watched: !choice?.ignoredStops.includes(stop),
            toggle: () =>
                choice?.change(
                    toggledMember(ignorableStockInstructionStops, choice.ignoredStops, stop)
                )
        }))
    )
</script>

{#if choice}
    <p>{choice.intro}</p>
    <div class="group">You choose</div>
    <StopList {switches} {disabled} />
    <div class="group">Always</div>
    <StopList always={[limitStopCondition, goalStopCondition]} />
    <p class="note">Every new instruction starts with all of these on.</p>
{:else}
    <p>
        A standing instruction acts for you on each of your stock turns. It ends with the stock
        round, and it stops on its own when:
    </p>
    <StopList
        always={[
            limitStopCondition,
            ...ignorableStockInstructionStops.map((stop) => ignorableStopCondition[stop]),
            goalStopCondition
        ]}
    />
{/if}

<style>
    p {
        margin: 0 0 6px;
    }
    .note {
        margin: 8px 0 0;
        padding-top: 6px;
        border-top: 1px solid var(--rail-border, #485666);
        color: var(--rail-muted, #7f8e9e);
        font-size: 11px;
    }
    .group {
        margin: 8px 0 2px;
        font-size: 10px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--rail-muted, #7f8e9e);
    }
</style>
