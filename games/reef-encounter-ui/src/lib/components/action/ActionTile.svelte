<script lang="ts">
    import type { Snippet } from 'svelte'
    import ChoiceButton from './ChoiceButton.svelte'

    // One action from the player aid: its number and verb, then icons for what it does. With no
    // onclick the action is done on the board, so the tile is an outline rather than a button.
    let {
        step,
        verb,
        label,
        onclick,
        children
    }: {
        step: number
        verb: string
        label: string
        onclick?: () => void
        children?: Snippet
    } = $props()
</script>

{#snippet content()}
    <span class="step reef-display" aria-hidden="true">{step}</span>
    <span class="verb reef-display" aria-hidden="true">{verb}</span>
    {#if children}<span class="icons" aria-hidden="true">{@render children()}</span>{/if}
{/snippet}

<div class="tile">
    {#if onclick}
        <ChoiceButton {label} {onclick}>{@render content()}</ChoiceButton>
    {:else}
        <span class="on-board" title="{label} on the board">
            <span class="sr-only">{label} on the board</span>
            {@render content()}
        </span>
    {/if}
</div>

<style>
    .tile {
        display: contents;
    }

    .tile :global(.choice),
    .on-board {
        min-height: 44px;
        padding: 4px 12px 4px 6px;
        gap: 6px;
        border-radius: 22px;
    }

    .on-board {
        display: inline-flex;
        align-items: center;
        color: var(--reef-muted);
        border: 1.5px dashed rgb(29 71 63 / 0.4);
    }

    .step {
        display: inline-grid;
        place-items: center;
        flex: none;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        font-size: 13px;
        font-weight: 600;
        color: #fff;
        background: var(--reef-teal);
    }

    .on-board .step {
        background: rgb(29 71 63 / 0.45);
    }

    .verb {
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 0.04em;
    }

    .icons {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 13px;
    }

    @media (max-width: 639px) {
        .tile :global(.choice),
        .on-board {
            min-height: 40px;
            padding: 3px 9px 3px 4px;
            gap: 4px;
        }

        .verb {
            font-size: 12px;
        }
    }
</style>
