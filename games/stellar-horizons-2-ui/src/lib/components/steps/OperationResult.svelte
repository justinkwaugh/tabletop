<script lang="ts">
    import {
        isMine,
        shipDefinition,
        type HydratedStellarHorizonsGameState,
        type Mine,
        type Research
    } from '@tabletop/stellar-horizons-2'
    import { FIELD_COLORS } from '$lib/utils/presentation.js'
    import DieFace from '../DieFace.svelte'
    import WorldImage from '../WorldImage.svelte'

    const DIE_SIZE = 40
    const CHIT_SIZE = 36
    const WORLD_SIZE = 40

    // A mining or research roll laid out as an exploration result: the world worked, the ship
    // and what it did, the die (two for the Mining Conglomerate, the lower used) and what it
    // earned: the cash, or a marker of the world's type drawn once everyone has explored.
    let {
        action,
        gameState
    }: { action: Mine | Research; gameState: HydratedStellarHorizonsGameState } = $props()

    const result = $derived(action.metadata)
    const world = $derived(
        result ? gameState.systemState(result.systemId).worlds[action.slot] : undefined
    )
    const mining = $derived(isMine(action))
    const dice = $derived(result ? (result.rolls ?? [result.roll]) : [])
    const dieLabel = $derived(
        result
            ? `Rolled ${result.roll}: ${result.target} or less ${mining ? 'earns $2B' : 'earns a marker'}`
            : ''
    )
</script>

{#if result}
    <div class="result" role="row">
        <span class="world">
            {#if world}
                <WorldImage tileId={world.tileId} side={world.side} size={WORLD_SIZE} />
            {/if}
        </span>
        <span class="head">
            <span class="ship">{shipDefinition(action.shipId).name}</span>
            <span class="what">{mining ? 'mined' : 'researched'}</span>
        </span>
        <span class="roll">
            {#each dice as face, index (index)}
                <DieFace face={String(face)} color="red" size={DIE_SIZE} label={dieLabel} />
            {/each}
        </span>
        <span class="outcome">
            {#if mining}
                <span class="cash" class:rich={result.success}>${result.cash}B</span>
            {:else if result.success && result.field}
                <span
                    class="pending"
                    style:--field={FIELD_COLORS[result.field]}
                    style:--size="{CHIT_SIZE}px"
                    title="A {result.field.toLowerCase()} marker, drawn once everyone has explored"
                    >?</span
                >
            {:else}
                <span class="tag">No marker</span>
            {/if}
        </span>
    </div>
{/if}

<style>
    .result {
        display: grid;
        grid-column: span 4;
        grid-template-columns: subgrid;
        align-items: center;
        padding: 6px 0;
        border-top: 1px solid #1a2438;
    }

    .result:first-child {
        border-top: none;
    }

    .world {
        display: flex;
    }

    .world :global(img) {
        border-radius: 50%;
    }

    .head {
        display: flex;
        flex-direction: column;
        gap: 1px;
    }

    .ship {
        font-size: 14px;
        font-weight: 700;
        color: #e8f1ff;
        white-space: nowrap;
    }

    .what {
        font-size: 12px;
        color: #8fa4c2;
        white-space: nowrap;
    }

    .roll,
    .outcome {
        display: flex;
        align-items: center;
        gap: 4px;
        min-height: 40px;
    }

    .cash {
        font-size: 18px;
        font-weight: 800;
        color: #c9d6ea;
    }

    .cash.rich {
        color: #f4c430;
    }

    .tag {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #6f84a3;
        white-space: nowrap;
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
