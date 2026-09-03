<script lang="ts">
    // A politics card that grows to double size, centred where it sits, after the pointer has
    // rested on it for a moment (mouse) or the finger has held it (touch). Hover feedback only,
    // so it stays local to this component and outside the shared animation timeline.
    //
    // The enlarged view is a second copy of the card in a fixed layer on <body>, not a transform
    // on the card itself: the in-place card lives inside scroll containers and under GSAP deal
    // animators that own its transform, and a scaled element would be clipped by the former and
    // fought over by the latter.
    import { scale } from 'svelte/transition'
    import type { PoliticsCard as PoliticsCardModel } from '@tabletop/lowenherz'
    import PoliticsCard from './PoliticsCard.svelte'

    let { card }: { card: PoliticsCardModel } = $props()

    const HOLD_MS = 200
    const GROWTH = 2
    const CARD_ASPECT = 534 / 832
    const VIEWPORT_MARGIN = 16

    let anchor: HTMLElement | undefined = $state(undefined)
    let enlarged: { centerX: number; centerY: number; width: number } | undefined = $state(undefined)
    let holdTimer: ReturnType<typeof setTimeout> | undefined
    let suppressNextClick = false

    function enlargedGeometry(rect: DOMRect) {
        const maxWidth = window.innerWidth - VIEWPORT_MARGIN
        const maxHeight = window.innerHeight - VIEWPORT_MARGIN
        const width = Math.min(rect.width * GROWTH, maxWidth, maxHeight * CARD_ASPECT)
        return { centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2, width }
    }

    function beginHold(fromTouch: boolean) {
        cancelHold()
        holdTimer = setTimeout(() => {
            holdTimer = undefined
            if (!anchor) return
            enlarged = enlargedGeometry(anchor.getBoundingClientRect())
            // A press that turned into a preview is not a choice: swallow the click the release
            // is about to produce so the card underneath is not taken or applied by accident.
            if (fromTouch) suppressNextClick = true
        }, HOLD_MS)
    }

    function cancelHold() {
        if (holdTimer !== undefined) clearTimeout(holdTimer)
        holdTimer = undefined
    }

    function release() {
        cancelHold()
        enlarged = undefined
    }

    function onPointerEnter(event: PointerEvent) {
        if (event.pointerType === 'mouse') beginHold(false)
    }

    function onPointerDown(event: PointerEvent) {
        if (event.pointerType !== 'mouse') beginHold(true)
    }

    function onClickCapture(event: MouseEvent) {
        if (!suppressNextClick) return
        suppressNextClick = false
        event.stopPropagation()
        event.preventDefault()
    }

    function portalToBody(el: HTMLElement) {
        document.body.appendChild(el)
        return () => el.remove()
    }
</script>

<span
    bind:this={anchor}
    role="presentation"
    class="block w-full select-none [-webkit-touch-callout:none]"
    onpointerenter={onPointerEnter}
    onpointerleave={release}
    onpointerdown={onPointerDown}
    onpointerup={release}
    onpointercancel={release}
    onclickcapture={onClickCapture}
    oncontextmenu={(event) => {
        if (holdTimer !== undefined || enlarged) event.preventDefault()
    }}
>
    <PoliticsCard {card} />
</span>

{#if enlarged}
    <div
        {@attach portalToBody}
        class="pointer-events-none fixed z-[60]"
        style="left: {enlarged.centerX}px; top: {enlarged.centerY}px; width: {enlarged.width}px; transform: translate(-50%, -50%);"
    >
        <div transition:scale={{ start: 1 / GROWTH, duration: 150, opacity: 1 }} class="drop-shadow-2xl">
            <PoliticsCard {card} />
        </div>
    </div>
{/if}
