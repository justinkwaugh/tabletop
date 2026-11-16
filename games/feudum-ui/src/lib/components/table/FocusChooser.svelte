<script lang="ts">
    import { untrack } from 'svelte'
    import type { Attachment } from 'svelte/attachments'
    import type { BoardFocus, FocusArea, PickFrame } from '$lib/model/boardFocus.svelte.js'

    /**
     * The focus chooser. On a phone, four chips over the board's top edge: Map and the guild chips
     * frame that part of the board, the Tracks chip opens the sheet. On a desk, four buttons in the
     * zoom row: Whole board, the rest, then Map and the guild columns, each at the largest scale that
     * fits. A chip's dot says its area holds a lit target. It also follows the open pick, which is
     * the one place a choice moves the focus.
     */
    let {
        focus,
        lit,
        frame,
        turned,
        desk = false,
        onTracks
    }: {
        focus: BoardFocus
        lit: ReadonlySet<FocusArea>
        frame: PickFrame | undefined
        /** Which way up the phone is: the chosen view fits again when it turns. */
        turned: boolean
        /** In a desk's zoom row rather than over a phone's board. */
        desk?: boolean
        onTracks: () => void
    } = $props()

    const PhoneChips: readonly { readonly area: FocusArea; readonly label: string }[] = [
        { area: 'map', label: 'Map' },
        { area: 'west', label: 'West guilds' },
        { area: 'east', label: 'East guilds' },
        { area: 'tracks', label: 'Tracks' }
    ]
    const DeskChips: readonly { readonly area: FocusArea; readonly label: string }[] = [
        { area: 'board', label: 'Whole board' },
        { area: 'map', label: 'Map' },
        { area: 'west', label: 'West guilds' },
        { area: 'east', label: 'East guilds' }
    ]

    let chips = $derived(desk ? DeskChips : PhoneChips)
    let frameKey = $derived(frame?.key)

    const settleOnTheChip: Attachment<HTMLElement> = () => {
        void turned
        untrack(() => focus.settle())
    }

    const followThePick: Attachment<HTMLElement> = () => {
        void frameKey
        untrack(() => focus.follow(frame))
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
    class:desk
    role="group"
    aria-label="Focus the board"
    data-focus-chooser={desk ? 'desk' : 'phone'}
    {@attach settleOnTheChip}
    {@attach followThePick}
>
    {#each chips as { area, label } (area)}
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

    /* 44 px to press, over the board's edge, for a chip drawn no taller than the budget allows. */
    .chip::after {
        content: '';
        position: absolute;
        inset: -2px 0 -12px;
    }

    /* Contract, Supply: in the zoom row, drawn as the Key and Supply buttons beside it. */
    .chooser.desk {
        position: static;
        gap: 0.25rem;
        margin-left: 0.5rem;
        pointer-events: auto;
    }

    .desk .chip {
        flex: 0 0 auto;
        height: 2.25rem;
        padding: 0 0.75rem;
        border-width: 2px;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        font-weight: 600;
    }

    /* 44 px to press, for a button drawn the zoom controls' height. */
    .desk .chip::after {
        inset: -0.25rem 0;
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
