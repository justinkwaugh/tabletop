<script lang="ts">
    // A politics card that grows to four times its size, centred where it sits, after the pointer has
    // rested on it for a moment (mouse) or the finger has held it (touch). Hover feedback only,
    // so it stays local to this component and outside the shared animation timeline.
    //
    // The enlarged view is a second copy of the card in a fixed layer on <body>, not a transform
    // on the card itself: the in-place card lives inside scroll containers and under GSAP deal
    // animators that own its transform, and a scaled element would be clipped by the former and
    // fought over by the latter.
    //
    // Which card is enlarged, and by how much, is also published on the session so the pile's
    // take animator can carry on from it: when that animator takes the card over it clears the
    // session entry, and the copy here leaves instantly instead of shrinking beside the real card.
    import { scale } from 'svelte/transition'
    import type { PoliticsCard as PoliticsCardModel } from '@tabletop/lowenherz'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PoliticsCard from './PoliticsCard.svelte'

    let { card }: { card: PoliticsCardModel } = $props()

    const gameSession = getGameSession()

    const HOLD_MS = 200
    const GROWTH = 4
    const CARD_ASPECT = 534 / 832
    const VIEWPORT_MARGIN = 16

    let anchor: HTMLElement | undefined = $state(undefined)
    let enlarged: { centerX: number; centerY: number; width: number } | undefined = $state(undefined)
    let holdTimer: ReturnType<typeof setTimeout> | undefined
    let suppressNextClick = false

    const showingCopy = $derived(
        enlarged !== undefined && gameSession.magnifiedPoliticsCard?.cardId === card.id
    )

    // Centred on the card, then nudged only as far as needed to keep the whole copy inside the
    // viewport - at this growth a card near an edge would otherwise hang off the screen.
    function enlargedGeometry(rect: DOMRect) {
        const maxWidth = window.innerWidth - 2 * VIEWPORT_MARGIN
        const maxHeight = window.innerHeight - 2 * VIEWPORT_MARGIN
        const width = Math.min(rect.width * GROWTH, maxWidth, maxHeight * CARD_ASPECT)
        const height = width / CARD_ASPECT
        const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
        return {
            centerX: clamp(rect.left + rect.width / 2, VIEWPORT_MARGIN + width / 2, window.innerWidth - VIEWPORT_MARGIN - width / 2),
            centerY: clamp(rect.top + rect.height / 2, VIEWPORT_MARGIN + height / 2, window.innerHeight - VIEWPORT_MARGIN - height / 2),
            width
        }
    }

    function beginHold(fromTouch: boolean) {
        cancelHold()
        holdTimer = setTimeout(() => {
            holdTimer = undefined
            if (!anchor) return
            const rect = anchor.getBoundingClientRect()
            enlarged = enlargedGeometry(rect)
            gameSession.magnifiedPoliticsCard = { cardId: card.id, scale: enlarged.width / rect.width }
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
        if (gameSession.magnifiedPoliticsCard?.cardId === card.id) {
            gameSession.magnifiedPoliticsCard = undefined
        }
    }

    // Hover means the pointer moving over the card, so the hold starts on pointer movement, not
    // on pointerenter. Enter also fires when the DOM changes under a stationary pointer - for
    // example when a clicked ACTIVE strip is replaced by an APPLY pill that bounces in from
    // nothing - which briefly exposed the card beneath and grew a copy the player never asked
    // for, only to shrink it again as the pill grew back under the pointer.
    function onPointerMove(event: PointerEvent) {
        if (event.pointerType !== 'mouse') return
        if (holdTimer !== undefined || enlarged) return
        beginHold(false)
    }

    function onPointerDown(event: PointerEvent) {
        if (event.pointerType !== 'mouse') beginHold(true)
    }

    // A mouse keeps the card enlarged through the click, so a take can carry on from the enlarged
    // size (see the take animator); it releases on leaving. A finger releases on lifting.
    function onPointerUp(event: PointerEvent) {
        if (event.pointerType !== 'mouse') release()
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

    function clearOnUnmount() {
        return () => release()
    }
</script>

<span
    bind:this={anchor}
    {@attach clearOnUnmount}
    role="presentation"
    class="block w-full select-none [-webkit-touch-callout:none]"
    onpointermove={onPointerMove}
    onpointerleave={release}
    onpointerdown={onPointerDown}
    onpointerup={onPointerUp}
    onpointercancel={release}
    onclickcapture={onClickCapture}
    oncontextmenu={(event) => {
        if (holdTimer !== undefined || enlarged) event.preventDefault()
    }}
>
    <PoliticsCard {card} />
</span>

{#if showingCopy && enlarged}
    <div
        {@attach portalToBody}
        class="pointer-events-none fixed z-[60]"
        style="left: {enlarged.centerX}px; top: {enlarged.centerY}px; width: {enlarged.width}px; transform: translate(-50%, -50%);"
    >
        <!-- The outro is instant when the take animator has taken the card over (the session
             entry is gone while this magnifier still holds its geometry), and a shrink otherwise. -->
        <div
            in:scale={{ start: 1 / GROWTH, duration: 150, opacity: 1 }}
            out:scale={{ start: 1 / GROWTH, duration: enlarged !== undefined ? 0 : 150, opacity: 1 }}
            class="drop-shadow-2xl"
        >
            <PoliticsCard {card} />
        </div>
    </div>
{/if}
