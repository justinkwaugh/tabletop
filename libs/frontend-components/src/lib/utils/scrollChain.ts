import type { Point } from '@tabletop/common'
import { fling, fingerVelocity, type Fling } from './touchFling.js'

export type ScrollAxis = 'x' | 'y'

const EPSILON = 0.001
const AXIS_LOCK_DISTANCE = 6
/** Scroll positions can stop a fraction short of an edge under page zoom. */
const EDGE_SLACK = 0.5

const SCROLL_AXES = {
    x: {
        overflow: (style: CSSStyleDeclaration) => style.overflowX,
        overflows: (element: HTMLElement) => element.scrollWidth > element.clientWidth,
        position: 'scrollLeft',
        windowPosition: () => window.scrollX,
        windowScroll: (delta: number) => ({ left: delta })
    },
    y: {
        overflow: (style: CSSStyleDeclaration) => style.overflowY,
        overflows: (element: HTMLElement) => element.scrollHeight > element.clientHeight,
        position: 'scrollTop',
        windowPosition: () => window.scrollY,
        windowScroll: (delta: number) => ({ top: delta })
    }
} as const satisfies Record<ScrollAxis, unknown>

function scrollsAlong(element: HTMLElement, axis: ScrollAxis) {
    const scrollAxis = SCROLL_AXES[axis]
    return (
        /(auto|scroll|overlay)/.test(scrollAxis.overflow(getComputedStyle(element))) &&
        scrollAxis.overflows(element)
    )
}

function scrollWithFinger(element: HTMLElement, axis: ScrollAxis, fingerDelta: number) {
    const position = SCROLL_AXES[axis].position
    const start = element[position]
    element[position] -= fingerDelta
    return start - element[position]
}

function scrollWindowWithFinger(axis: ScrollAxis, fingerDelta: number) {
    const scrollAxis = SCROLL_AXES[axis]
    const start = scrollAxis.windowPosition()
    window.scrollBy(scrollAxis.windowScroll(-fingerDelta))
    return start - scrollAxis.windowPosition()
}

function* scrollersAround(element: HTMLElement, axis: ScrollAxis) {
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement)
        if (scrollsAlong(ancestor, axis)) yield ancestor
}

/** A touch carries on into the next scroller out, and finally the window, as each reaches its edge. */
export function scrollAncestorsWithFinger(
    element: HTMLElement,
    axis: ScrollAxis,
    fingerDelta: number
) {
    let remaining = fingerDelta
    for (const ancestor of scrollersAround(element, axis)) {
        if (Math.abs(remaining) <= EPSILON) break
        remaining -= scrollWithFinger(ancestor, axis, remaining)
    }
    if (Math.abs(remaining) > EPSILON) remaining -= scrollWindowWithFinger(axis, remaining)
    return fingerDelta - remaining
}

/** A wheel pan stops at the nearest scroller's edge; with none, it scrolls the window. */
export function scrollNearestAncestorWithFinger(
    element: HTMLElement,
    axis: ScrollAxis,
    fingerDelta: number
) {
    if (Math.abs(fingerDelta) <= EPSILON) return 0
    const [nearest] = scrollersAround(element, axis)
    return nearest
        ? scrollWithFinger(nearest, axis, fingerDelta)
        : scrollWindowWithFinger(axis, fingerDelta)
}

/** Touch events an inner attachment has taken, so the attachments around it leave them alone. */
const claimedTouchEvents = new WeakSet<TouchEvent>()

/**
 * Touch-action is read when a touch starts, so it has to follow the overflow ahead of the swipe.
 * Content can widen without the element resizing or its DOM changing, as when a web font loads, so
 * the element's children are watched for size changes too.
 */
function watchSidewaysOverflow(element: HTMLElement, onChange: (overflows: boolean) => void) {
    let overflows: boolean | undefined
    let frame: number | undefined
    const check = () => {
        frame = undefined
        const next = SCROLL_AXES.x.overflows(element)
        if (next === overflows) return
        overflows = next
        onChange(next)
    }
    const scheduleCheck = () => {
        frame ??= requestAnimationFrame(check)
    }
    const resizes = new ResizeObserver(scheduleCheck)
    const watchSizes = () => {
        resizes.disconnect()
        resizes.observe(element)
        for (const child of element.children) resizes.observe(child)
    }
    const changes = new MutationObserver((records) => {
        if (records.some((record) => record.type === 'childList' && record.target === element))
            watchSizes()
        scheduleCheck()
    })
    watchSizes()
    changes.observe(element, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true
    })
    return () => {
        if (frame !== undefined) cancelAnimationFrame(frame)
        resizes.disconnect()
        changes.disconnect()
    }
}

function canScrollSidewaysWithFinger(element: HTMLElement, fingerDelta: number) {
    return fingerDelta > 0
        ? element.scrollLeft > EDGE_SLACK
        : element.scrollLeft < element.scrollWidth - element.clientWidth - EDGE_SLACK
}

function sidewaysSwipeTarget(element: HTMLElement, fingerDelta: number) {
    for (
        let candidate: HTMLElement | null = element;
        candidate;
        candidate = candidate.parentElement
    )
        if (scrollsAlong(candidate, 'x') && canScrollSidewaysWithFinger(candidate, fingerDelta))
            return candidate
    return element
}

/**
 * iOS Safari never hands a swipe from a scroller to the scrollers around it, so the phone table
 * could not be reached from one.
 */
export function chainSidewaysScroll(element: HTMLElement) {
    let swipeOrigin: Point | undefined
    let lastX = 0
    let lastTimestamp = 0
    // A swipe that starts at the edge it moves toward goes to the scroller around this one.
    let target: HTMLElement | undefined
    let velocity = 0
    let currentFling: Fling | undefined
    let sidewaysOverflow = false

    const onTouchStart = (event: TouchEvent) => {
        currentFling?.stop()
        swipeOrigin = undefined
        if (!sidewaysOverflow || claimedTouchEvents.has(event) || event.touches.length !== 1) return
        claimedTouchEvents.add(event)
        const touch = event.touches[0]
        swipeOrigin = { x: touch.clientX, y: touch.clientY }
        lastX = touch.clientX
        lastTimestamp = event.timeStamp
        target = undefined
        velocity = 0
    }

    const onTouchMove = (event: TouchEvent) => {
        if (!swipeOrigin || claimedTouchEvents.has(event)) return
        if (event.touches.length !== 1) {
            swipeOrigin = undefined
            return
        }
        claimedTouchEvents.add(event)
        const touch = event.touches[0]
        if (!target) {
            const distanceX = Math.abs(touch.clientX - swipeOrigin.x)
            const distanceY = Math.abs(touch.clientY - swipeOrigin.y)
            if (Math.max(distanceX, distanceY) < AXIS_LOCK_DISTANCE) return
            if (distanceY >= distanceX) {
                swipeOrigin = undefined
                return
            }
            target = sidewaysSwipeTarget(element, touch.clientX - swipeOrigin.x)
        }
        event.preventDefault()
        const delta = touch.clientX - lastX
        const elapsed = Math.max(1, event.timeStamp - lastTimestamp)
        lastX = touch.clientX
        lastTimestamp = event.timeStamp
        scrollWithFinger(target, 'x', delta)
        velocity = fingerVelocity(velocity, delta, elapsed)
    }

    const onTouchEnd = (event: TouchEvent) => {
        if (!swipeOrigin || event.touches.length > 0) return
        if (target) {
            const flung = target
            currentFling = fling(
                { x: velocity, y: 0 },
                event.timeStamp - lastTimestamp,
                (offset) => ({ x: scrollWithFinger(flung, 'x', offset.x), y: 0 }),
                flung
            )
        }
        swipeOrigin = undefined
    }

    const onTouchCancel = () => {
        swipeOrigin = undefined
    }

    const stopWatching = watchSidewaysOverflow(element, (next) => {
        sidewaysOverflow = next
        element.style.touchAction = next ? 'pan-y pinch-zoom' : ''
    })
    element.addEventListener('touchstart', onTouchStart, { passive: true })
    element.addEventListener('touchmove', onTouchMove, { passive: false })
    element.addEventListener('touchend', onTouchEnd)
    element.addEventListener('touchcancel', onTouchCancel)
    return () => {
        currentFling?.stop()
        stopWatching()
        element.style.touchAction = ''
        element.removeEventListener('touchstart', onTouchStart)
        element.removeEventListener('touchmove', onTouchMove)
        element.removeEventListener('touchend', onTouchEnd)
        element.removeEventListener('touchcancel', onTouchCancel)
    }
}
