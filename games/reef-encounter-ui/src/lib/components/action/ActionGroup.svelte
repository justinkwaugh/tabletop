<script lang="ts" generics="T">
    import type { Snippet } from 'svelte'
    import ActionTile from './ActionTile.svelte'

    // One action from the player aid offered several ways, such as for each colour: its number
    // and verb once, then a button for each way. With one way it is an ordinary tile.
    let {
        step,
        verb,
        items,
        key,
        label,
        onselect,
        icon,
        result
    }: {
        step: number
        verb: string
        items: readonly T[]
        key: (item: T) => string
        label: (item: T) => string
        onselect: (item: T) => void
        icon: Snippet<[T]>
        // What the way under the pointer or focus gives, shown once after them; with no way
        // chosen it gets undefined and shows what every way gives.
        result?: Snippet<[T | undefined]>
    } = $props()

    let shown: T | undefined = $state()
</script>

{#if items.length === 1}
    {@const item = items[0]}
    <ActionTile {step} {verb} label={label(item)} onclick={() => onselect(item)}>
        {@render icon(item)}
        {#if result}{@render result(item)}{/if}
    </ActionTile>
{:else if items.length > 1}
    <div class="group" role="group" aria-label="{step} {verb}">
        <span class="step reef-display" aria-hidden="true">{step}</span>
        <span class="verb reef-display" aria-hidden="true">{verb}</span>
        {#each items as item (key(item))}
            <button
                type="button"
                class="option"
                aria-label={label(item)}
                onclick={() => onselect(item)}
                onpointerenter={() => (shown = item)}
                onpointerleave={() => (shown = undefined)}
                onfocus={() => (shown = item)}
                onblur={() => (shown = undefined)}
            >
                <span class="icons" aria-hidden="true">{@render icon(item)}</span>
            </button>
        {/each}
        {#if result}<span class="icons result" aria-hidden="true">{@render result(shown)}</span
            >{/if}
    </div>
{/if}

<style>
    .group {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        min-height: 44px;
        padding: 3px 4px 3px 6px;
        border-radius: 22px;
        color: var(--reef-paper-ink);
        background: linear-gradient(180deg, #fff, rgb(255 255 255 / 0) 70%), var(--reef-pearl);
        box-shadow:
            inset 0 0 0 1px rgb(255 255 255 / 0.9),
            0 2px 6px rgb(4 30 26 / 0.18);
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

    .verb {
        margin-right: 2px;
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 0.04em;
    }

    .option {
        display: inline-flex;
        align-items: center;
        min-height: 36px;
        padding: 2px 8px;
        border-radius: 18px;
        color: inherit;
        background: rgb(255 255 255 / 0.55);
        box-shadow: inset 0 0 0 1px rgb(29 71 63 / 0.18);
        transition:
            transform 0.12s,
            box-shadow 0.12s;
    }

    .option:hover {
        transform: translateY(-1px);
        box-shadow:
            inset 0 0 0 1.5px var(--reef-teal),
            0 4px 8px -3px rgb(4 30 26 / 0.3);
    }

    .option:active {
        transform: translateY(1px);
    }

    .option:focus-visible {
        outline: 2px solid var(--reef-accent);
        outline-offset: 2px;
    }

    .result {
        margin: 0 6px 0 2px;
    }

    .icons {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 13px;
    }

    @media (prefers-reduced-motion: reduce) {
        .option,
        .option:hover,
        .option:active {
            transform: none;
            transition: none;
        }
    }

    @media (max-width: 639px) {
        .group {
            min-height: 40px;
            gap: 3px;
            padding: 2px 3px 2px 4px;
        }

        .verb {
            font-size: 12px;
        }

        .option {
            min-height: 34px;
            padding: 2px 6px;
        }
    }
</style>
