<script lang="ts">
    import {
        EXPLORATION_STEP,
        TechField,
        isExplore,
        shipDefinition,
        type Explore
    } from '@tabletop/stellar-horizons-2'
    import type { GameAction } from '@tabletop/common'
    import { FIELD_COLORS, plural } from '$lib/utils/presentation.js'
    import DieFace from '../DieFace.svelte'

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
            ? ([TechField.Biology, TechField.Engineering] as const).flatMap((field) => {
                  const count = result.compensation[field] ?? 0
                  return count > 0 ? [{ field, count }] : []
              })
            : []
    )
</script>

{#if explore && result}
    <div class="result" class:heads class:follows role="row">
        <span class="head">
            <span class="ship">{shipDefinition(explore.shipId).name}</span>
            <span class="status">
                {#if result.markerCount === 0}
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
            {#each { length: result.markerCount } as _, index (index)}
                <span
                    class="pending"
                    style:--field={FIELD_COLORS[result.field]}
                    style:--size="{CHIT_SIZE}px"
                    title="A {result.field.toLowerCase()} marker, drawn once everyone has explored"
                    >?</span
                >
            {/each}
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
            {#each salvage as entry (entry.field)}
                {#each { length: entry.count } as _, index (index)}
                    <span
                        class="pending"
                        style:--field={FIELD_COLORS[entry.field]}
                        style:--size="{CHIT_SIZE}px"
                        title="A {entry.field.toLowerCase()} marker in compensation, drawn once everyone has explored"
                        >?</span
                    >
                {/each}
            {/each}
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

    .tag.bad {
        color: #ff8a7a;
    }

    .tag.quiet {
        color: #6f84a3;
    }

    /* A marker earned but not yet drawn: the field's colour with its value still unknown. */
    .pending {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: var(--size);
        height: var(--size);
        border-radius: 6px;
        border: 2px dashed var(--field);
        color: var(--field);
        font-size: 16px;
        font-weight: 700;
    }
</style>
