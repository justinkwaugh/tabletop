<script lang="ts">
    import { escalationDefinition, type EscalationMarker } from '@tabletop/stellar-horizons-2'
    import { ESCALATION_FACE, escalationName } from '$lib/utils/escalation.js'

    let {
        marker,
        size = 44,
        selected = false,
        onclick
    }: {
        marker: EscalationMarker
        size?: number
        selected?: boolean
        onclick?: () => void
    } = $props()

    const definition = $derived(escalationDefinition(marker))
    const points = $derived(definition.effects.points)
    const face = $derived(ESCALATION_FACE[marker])
</script>

<svelte:element
    this={onclick ? 'button' : 'span'}
    type={onclick ? 'button' : undefined}
    class="chip"
    class:penalty={definition.effects.penalty}
    class:selected
    style:--size="{size}px"
    title={escalationName(marker)}
    aria-label={escalationName(marker)}
    aria-pressed={onclick ? selected : undefined}
    role={onclick ? undefined : 'img'}
    {onclick}
>
    {#if points !== undefined}
        <b class="points">{points}</b>
    {:else if face}
        <span class="text">{face[0]}<br />{face[1]}</span>
    {/if}
</svelte:element>

<style>
    .chip {
        display: inline-flex;
        flex-shrink: 0;
        align-items: center;
        justify-content: center;
        width: var(--size);
        height: var(--size);
        padding: 2px;
        border-radius: 4px;
        border: 1px solid #5a5296;
        background: #2f2a63;
        color: #fff;
    }

    .penalty {
        border-color: #a8443d;
        background: #7c2420;
    }

    button.chip {
        cursor: pointer;
        opacity: 0.55;
    }

    button.chip.selected {
        opacity: 1;
        outline: 2px solid #f2d27a;
        outline-offset: 1px;
    }

    .points {
        display: grid;
        place-items: center;
        width: 62%;
        height: 62%;
        border-radius: 50%;
        border: 2px solid #c99a2e;
        background: #f3e3a4;
        color: #1b1b1b;
        font-size: calc(var(--size) * 0.32);
        font-weight: 900;
        line-height: 1;
    }

    .text {
        font-size: calc(var(--size) * 0.24);
        font-weight: 700;
        line-height: 1.1;
        text-align: center;
        white-space: nowrap;
    }
</style>
