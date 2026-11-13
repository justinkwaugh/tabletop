<script lang="ts">
    import type { ScalingWrapper } from '@tabletop/frontend-components'
    import type { RectangleDimensions } from '@tabletop/common'
    import type { Attachment } from 'svelte/attachments'
    import type { BoardFocusSelection } from '$lib/model/boardFocus.svelte.js'
    import {
        BOARD_FOCUSES,
        focusRequest,
        restingFocus,
        showsFocusChooser,
        type BoardFocus
    } from '$lib/utils/boardFocus.js'
    import { boardInsetTop } from '$lib/utils/phoneLayout.svelte.js'

    let {
        wrapper,
        viewport,
        selection
    }: {
        wrapper: ScalingWrapper | undefined
        viewport: HTMLElement
        selection: BoardFocusSelection
    } = $props()

    // Contract, Phone layout (U-8): shown only while a hex is small on screen.
    const shown = $derived(wrapper !== undefined && showsFocusChooser(wrapper.viewScale()))

    // The view the wrapper fits into: its viewport below the chooser's inset.
    function viewOf(element: HTMLElement): RectangleDimensions {
        return {
            width: element.clientWidth,
            height: Math.max(0, element.clientHeight - boardInsetTop())
        }
    }

    function show(focus: BoardFocus, animate: boolean) {
        if (!wrapper) return
        const request = focusRequest(focus, viewOf(viewport))
        wrapper.focusRect(request.rect, { maxScale: request.maxScale, padding: 0, animate })
        selection.choose(focus)
    }

    // A phone's view first rests on the middle third with hexes at least 33 px, not the wrapper's
    // cover fit; a chosen focus is kept at its scale as the view resizes.
    const followView: Attachment<HTMLElement> = () => {
        const view = viewport
        let rested = false
        const observer = new ResizeObserver(() => {
            const size = viewOf(view)
            if (!wrapper || size.width === 0 || size.height === 0) return
            if (!rested) {
                rested = true
                const resting = restingFocus(size)
                if (resting) show(resting, false)
            } else if (selection.current) {
                show(selection.current, false)
            }
        })
        observer.observe(view)
        return () => observer.disconnect()
    }
</script>

<div class="chooser-anchor" {@attach followView}>
    {#if shown}
        <div class="chooser shadow-md" role="group" aria-label="Focus the map">
            {#each BOARD_FOCUSES as { focus, label } (focus)}
                <button
                    type="button"
                    class:on={selection.current === focus}
                    aria-pressed={selection.current === focus}
                    onclick={() => show(focus, true)}>{label}</button
                >
            {/each}
        </div>
    {/if}
</div>

<style>
    .chooser-anchor {
        position: absolute;
        top: 6px;
        left: 0;
        right: 0;
        display: flex;
        justify-content: center;
        pointer-events: none;
    }

    .chooser {
        display: flex;
        gap: 2px;
        padding: 3px;
        border-radius: 10px;
        border: 1px solid var(--rtr-line);
        background: var(--rtr-panel);
        pointer-events: auto;
    }

    button {
        padding: 4px 11px;
        border-radius: 7px;
        color: var(--rtr-ink);
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
    }

    button:focus-visible {
        outline: 2px solid var(--rtr-accent);
    }

    button.on {
        background: var(--rtr-ink);
        color: var(--rtr-panel);
    }
</style>
