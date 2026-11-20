<script lang="ts">
    import { untrack } from 'svelte'
    import type { Attachment } from 'svelte/attachments'
    import type { BoardFocus, FocusArea } from '$lib/model/boardFocus.svelte.js'

    let {
        focus,
        lit,
        turned,
        onTracks
    }: {
        focus: BoardFocus
        lit: ReadonlySet<FocusArea>
        turned: boolean
        onTracks: () => void
    } = $props()

    const Chips: readonly { readonly area: FocusArea; readonly label: string }[] = [
        { area: 'map', label: 'Map' },
        { area: 'west', label: 'West guilds' },
        { area: 'east', label: 'East guilds' },
        { area: 'tracks', label: 'Tracks' }
    ]

    /** The scaling wrapper's view is an imperative camera, so it is moved, not bound. */
    const moveTheView: Attachment<HTMLElement> = () => {
        void [focus.framed, focus.chosen, turned]
        untrack(() => focus.settle())
    }

    function press(area: FocusArea) {
        if (area === 'tracks') {
            onTracks()
        } else {
            focus.choose(area)
        }
    }
</script>

<div
    class="chooser"
    role="group"
    aria-label="Focus the board"
    data-focus-chooser="phone"
    {@attach moveTheView}
>
    {#each Chips as { area, label } (area)}
        <button
            type="button"
            class="chip"
            aria-pressed={area !== 'tracks' && focus.shown === area}
            data-focus-chip={area}
            onclick={() => press(area)}
        >
            {label}
            {#if lit.has(area)}
                <span class="dot" data-lit-dot></span>
            {/if}
        </button>
    {/each}
</div>

<style>
    .chooser {
        position: absolute;
        top: 2px;
        left: 4px;
        right: 4px;
        display: flex;
        gap: 2px;
        z-index: 10;
    }

    .chip {
        position: relative;
        flex: 1 1 0;
        min-width: 0;
        height: 32px;
        border: 1px solid var(--feudum-frame);
        border-radius: 8px;
        background: var(--feudum-surface-raised);
        color: var(--feudum-text);
        font-size: 12px;
        line-height: 1;
        white-space: nowrap;
    }

    .chip[aria-pressed='true'] {
        border-color: var(--feudum-accent);
        background: var(--feudum-primary);
    }

    /* A 44 px press target for a chip drawn shorter. */
    .chip::after {
        content: '';
        position: absolute;
        inset: -2px 0 -12px;
    }

    .dot {
        position: absolute;
        top: 3px;
        right: 3px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--feudum-accent);
        box-shadow: 0 0 4px var(--feudum-accent);
    }
</style>
