<script lang="ts">
    import {
        EXPLORATION_STEP,
        TechField,
        isExplore,
        shipDefinition,
        type Explore
    } from '@tabletop/stellar-horizons-2'
    import type { GameAction } from '@tabletop/common'
    import { plural } from '$lib/utils/presentation.js'
    import DieFace from '../DieFace.svelte'
    import TechMarker from '../TechMarker.svelte'

    const DIE_SIZE = 40
    const CHIT_SIZE = 36

    // `heads`: the result tops its column. `follows`: its column has another to its left.
    let {
        action,
        heads = false,
        follows = false
    }: { action: GameAction; heads?: boolean; follows?: boolean } = $props()
    const explore: Explore | undefined = $derived(isExplore(action) ? action : undefined)
    const result = $derived(explore?.metadata)
    const extraMarkerTarget = $derived(result ? result.explorationValue % EXPLORATION_STEP : 0)
    const malfunctionLabel = $derived(
        result
            ? `Rolled ${result.malfunctionRoll}%: ${result.malfunctionRate}% or less is a malfunction`
            : ''
    )
    const malfunctioned = $derived(result ? result.destroyed || result.damage > 0 : false)
    const salvage = $derived(
        result
            ? [
                  ...(result.compensation[TechField.Biology] ?? []).map((value) => ({
                      field: TechField.Biology,
                      value
                  })),
                  ...(result.compensation[TechField.Engineering] ?? []).map((value) => ({
                      field: TechField.Engineering,
                      value
                  }))
              ]
            : []
    )
</script>

{#if explore && result}
    <div class="result" class:heads class:follows role="row">
        <span class="head">
            <span class="ship">{shipDefinition(explore.shipId).name}</span>
            <span class="status">
                {#if result.survey}
                    <span class="tag good">Survey</span>
                {:else if result.markers.length === 0 && !result.cash}
                    <span class="tag quiet">Failed</span>
                {/if}
                {#if malfunctioned}
                    <span class="tag bad">
                        {#if result.destroyed}
                            Ship lost{result.settlementsLost > 0
                                ? ` · ${plural(result.settlementsLost, 'settlement')}`
                                : ''}
                        {:else}
                            {result.damage} damage{result.crippled ? ' · crippled' : ''}
                        {/if}
                    </span>
                {/if}
            </span>
        </span>
        <span class="roll">
            {#if result.rewardRoll !== undefined}
                <DieFace
                    face={String(result.rewardRoll)}
                    color="red"
                    size={DIE_SIZE}
                    label="Rolled {result.rewardRoll}: {extraMarkerTarget} or less earns one more marker"
                />
            {/if}
        </span>
        <span class="found">
            {#each result.markers as value, index (index)}
                <TechMarker field={result.field} {value} size={CHIT_SIZE} />
            {/each}
            {#if result.cash}
                <span class="cash" title="The pool was empty, so each missing marker paid $1B"
                    >${result.cash}B</span
                >
            {/if}
        </span>
        <span class="malfunction">
            <DieFace
                face={String(Math.floor((result.malfunctionRoll % 100) / 10)) + '0'}
                color="black"
                size={DIE_SIZE}
                label={malfunctionLabel}
            />
            <DieFace
                face={String(result.malfunctionRoll % 10)}
                color="black"
                size={DIE_SIZE}
                label={malfunctionLabel}
            />
        </span>
        <span class="outcome">
            {#each salvage as marker, index (index)}
                <TechMarker field={marker.field} value={marker.value} size={CHIT_SIZE} />
            {/each}
            {#if result.compensation.cash}
                <span class="cash">${result.compensation.cash}B</span>
            {/if}
        </span>
    </div>
{/if}

<style>
    /* A row of the results table laid out by ExplorationStep. The ship's name and the outcome
       labels share a line; under it sit the exploration die, what it found, the malfunction
       dice and anything salvaged, in columns shared by every row. */
    .result {
        display: grid;
        grid-column: span 4;
        grid-template-columns: subgrid;
        align-items: center;
        padding: 6px 0;
        border-top: 1px solid #1a2438;
    }

    .result.heads {
        border-top: none;
    }

    /* In columns, each column after the first is ruled off from the one before. */
    :global(.results.columns) > .result {
        padding-right: 8px;
    }

    .result.follows {
        margin-left: -10px;
        padding-left: 18px;
        border-left: 1px solid #1a2438;
    }

    .head {
        display: flex;
        grid-column: 1 / -1;
        align-items: baseline;
        justify-content: space-between;
        gap: 18px;
        padding-bottom: 2px;
    }

    .status {
        display: flex;
        gap: 10px;
    }

    .ship {
        font-size: 14px;
        font-weight: 700;
        color: #e8f1ff;
        white-space: nowrap;
    }

    .roll,
    .found,
    .malfunction,
    .outcome {
        display: flex;
        align-items: center;
        min-height: 40px;
    }

    .found,
    .outcome {
        gap: 6px;
    }

    .malfunction {
        gap: 1px;
        padding-left: 10px;
        border-left: 1px solid #22314d;
    }

    /* Outcomes are set like the table's other labels: small tracked capitals. */
    .tag {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        white-space: nowrap;
    }

    .tag.good {
        color: #7fe08a;
    }

    .tag.bad {
        color: #ff8a7a;
    }

    .tag.quiet {
        color: #6f84a3;
    }

    .cash {
        font-size: 15px;
        font-weight: 700;
        color: #f2c94c;
    }
</style>
