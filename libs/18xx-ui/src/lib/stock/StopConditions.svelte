<script lang="ts" module>
    import type { IgnorableStockInstructionStop } from '@tabletop/18xx'

    export type StopChoice = {
        intro: string
        ignoredStops: readonly IgnorableStockInstructionStop[]
        change: (ignoredStops: IgnorableStockInstructionStop[]) => void
    }
</script>

<script lang="ts">
    import { ignorableStockInstructionStops } from '@tabletop/18xx'
    import SwitchTrack from '../table/SwitchTrack.svelte'
    import {
        goalStopCondition,
        ignorableStopCondition,
        limitStopCondition
    } from './stockInstructionText.js'

    let { choice, disabled }: { choice: StopChoice | undefined; disabled: boolean } = $props()

    const alwaysStops = [limitStopCondition, goalStopCondition]

    function toggle(stop: IgnorableStockInstructionStop) {
        if (!choice) return
        const ignored = choice.ignoredStops.includes(stop)
        choice.change(
            ignored
                ? choice.ignoredStops.filter((item) => item !== stop)
                : [...choice.ignoredStops, stop]
        )
    }
</script>

{#if choice}
    <p>{choice.intro}</p>
    <div class="group">You choose</div>
    <ul>
        {#each ignorableStockInstructionStops as stop (stop)}
            {@const watched = !choice.ignoredStops.includes(stop)}
            <li>
                <button
                    class="switch"
                    role="switch"
                    aria-checked={watched}
                    {disabled}
                    onclick={() => toggle(stop)}
                    ><SwitchTrack on={watched} /><span class="condition"
                        >{ignorableStopCondition[stop]}</span
                    ></button
                >
            </li>
        {/each}
    </ul>
    <div class="group">Always</div>
    <ul>
        {#each alwaysStops as condition (condition)}
            <li class="always">{condition}</li>
        {/each}
    </ul>
    <p class="note">Every new instruction starts with all of these on.</p>
{:else}
    <p>
        A standing instruction acts for you on each of your stock turns. It ends with the stock
        round, and it stops on its own when:
    </p>
    <ul>
        <li class="always">{limitStopCondition}</li>
        {#each ignorableStockInstructionStops as stop (stop)}
            <li class="always">{ignorableStopCondition[stop]}</li>
        {/each}
        <li class="always">{goalStopCondition}</li>
    </ul>
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
    ul {
        margin: 0;
        padding: 0;
        list-style: none;
    }
    li + li {
        margin-top: 4px;
    }
    .always {
        position: relative;
        padding-left: 16px;
    }
    .always::before {
        content: '';
        position: absolute;
        left: 3px;
        top: 0.55em;
        width: 5px;
        height: 5px;
        border-radius: 999px;
        background: var(--rail-positive, #2e7d5b);
    }
    .switch {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 0;
        border: 0;
        background: transparent;
        font: inherit;
        line-height: 1.4;
        text-align: left;
        color: var(--rail-text, #e3e9ef);
        cursor: pointer;
    }
    .switch:disabled {
        opacity: 0.45;
        cursor: default;
    }
    .switch:focus-visible {
        outline: 2px solid var(--rail-focus, #b8cddd);
        outline-offset: 1px;
    }
    .switch[aria-checked='false'] .condition {
        color: var(--rail-muted, #7f8e9e);
        text-decoration: line-through;
    }
</style>
