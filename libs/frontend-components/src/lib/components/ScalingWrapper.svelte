<script lang="ts">
    import { onDestroy, onMount, type Snippet } from 'svelte'

    const DISCRETE_ZOOM_STEP = 0.15
    const VIEW_ANIMATION_MS = 180
    const EPSILON = 0.001
    const PINCH_ZOOM_SENSITIVITY = 1.6
    const GESTURE_ZOOM_SENSITIVITY = 1.4

    type FocusRect = {
        x: number
        y: number
        width: number
        height: number
    }

    type FocusOptions = {
        maxScale?: number
        padding?: number | { x: number; y: number }
        animate?: boolean
    }

    type FocusTarget = {
        rect: FocusRect
        maxScale: number
        paddingX: number
        paddingY: number
        animate: boolean
    }

    type ViewMetrics = {
        scale: number
        scaledWidth: number
        scaledHeight: number
        scrollAreaWidth: number
        scrollAreaHeight: number
        offsetX: number
        offsetY: number
        maxLeft: number
        maxTop: number
    }

    let {
        children,
        justify = 'center',
        controls = 'top-left'
    }: {
        children: Snippet
        justify?: 'center' | 'left' | 'right'
        controls: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'none'
    } = $props()

    let baseScale = $state(1)
    let currentScale = $state(1)
    let zoomLevels = $state(0)

    let wrapperWidth = $state(0)
    let wrapperHeight = $state(0)

    let contentWidth = $state(0)
    let contentHeight = $state(0)

    let wrapper: HTMLElement
    let scroller: HTMLElement
    let scrollContent: HTMLElement
    let content: HTMLElement
    let measuredContent: HTMLElement

    let initialized = false
    let syncingView = false
    let activeFocusTarget = $state<FocusTarget | null>(null)
    let viewAnimationFrame: number | undefined
    let pendingDimensionSyncFrame: number | undefined
    let viewAnimationRequestId = 0
    let pinchDistance: number | null = null
    let gestureStartScale: number | null = null

    $effect(() => {
        let nextWrapperWidth = wrapperWidth
        let nextWrapperHeight = wrapperHeight
        let nextContentWidth = contentWidth
        let nextContentHeight = contentHeight

        if (!syncingView) {
            // Schedule outside the reactive effect so view-sync reads do not become dependencies.
            scheduleDimensionSync()
        }
    })

    function clamp(value: number, min: number, max: number) {
        return Math.min(max, Math.max(min, value))
    }

    function easeInOutCubic(t: number) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    }

    function normalizeFocusTarget(rect: FocusRect, options: FocusOptions = {}): FocusTarget {
        const padding =
            typeof options.padding === 'number'
                ? { x: options.padding, y: options.padding }
                : options.padding

        return {
            rect,
            maxScale: options.maxScale ?? 1,
            paddingX: padding?.x ?? 0,
            paddingY: padding?.y ?? 0,
            animate: options.animate ?? false
        }
    }

    function computeFitScale() {
        if (!wrapperWidth || !wrapperHeight || !contentWidth || !contentHeight) {
            return 1
        }

        return Math.min(wrapperWidth / contentWidth, wrapperHeight / contentHeight, 1)
    }

    function updateDiscreteLevels(fitScale: number) {
        zoomLevels = fitScale === 1 ? 0 : Math.floor((1 - fitScale) / DISCRETE_ZOOM_STEP)
    }

    function clampScale(scale: number) {
        return clamp(scale, baseScale, 1)
    }

    function getOffsetX(scaledWidth: number) {
        if (scaledWidth >= wrapperWidth) {
            return 0
        }

        switch (justify) {
            case 'left':
                return 0
            case 'right':
                return wrapperWidth - scaledWidth
            case 'center':
            default:
                return (wrapperWidth - scaledWidth) / 2
        }
    }

    function getMetrics(scale: number): ViewMetrics {
        const clampedScale = clampScale(scale)
        const scaledWidth = contentWidth * clampedScale
        const scaledHeight = contentHeight * clampedScale
        const scrollAreaWidth = Math.max(wrapperWidth, scaledWidth)
        const scrollAreaHeight = Math.max(wrapperHeight, scaledHeight)
        const offsetX = getOffsetX(scaledWidth)
        const offsetY = 0

        return {
            scale: clampedScale,
            scaledWidth,
            scaledHeight,
            scrollAreaWidth,
            scrollAreaHeight,
            offsetX,
            offsetY,
            maxLeft: Math.max(0, scrollAreaWidth - wrapperWidth),
            maxTop: Math.max(0, scrollAreaHeight - wrapperHeight)
        }
    }

    function applyLayout(scale: number) {
        if (!content || !scrollContent || !contentWidth || !contentHeight) {
            return getMetrics(scale)
        }

        const metrics = getMetrics(scale)
        currentScale = metrics.scale
        scrollContent.style.width = `${metrics.scrollAreaWidth}px`
        scrollContent.style.height = `${metrics.scrollAreaHeight}px`
        content.style.left = `${metrics.offsetX}px`
        content.style.top = `${metrics.offsetY}px`
        content.style.transform = `scale(${metrics.scale})`
        return metrics
    }

    function getViewportCenterContentPoint() {
        const metrics = getMetrics(currentScale)

        return {
            x: clamp(
                (scroller.scrollLeft + scroller.clientWidth / 2 - metrics.offsetX) / currentScale,
                0,
                contentWidth
            ),
            y: clamp(
                (scroller.scrollTop + scroller.clientHeight / 2 - metrics.offsetY) / currentScale,
                0,
                contentHeight
            )
        }
    }

    function getScrollForContentPointAtScale(contentX: number, contentY: number, scale: number) {
        const metrics = getMetrics(scale)
        return {
            left: clamp(
                metrics.offsetX + contentX * metrics.scale - scroller.clientWidth / 2,
                0,
                metrics.maxLeft
            ),
            top: clamp(
                metrics.offsetY + contentY * metrics.scale - scroller.clientHeight / 2,
                0,
                metrics.maxTop
            )
        }
    }

    function getViewForFocusTarget(target: FocusTarget) {
        const availableWidth = Math.max(1, wrapperWidth - target.paddingX * 2)
        const availableHeight = Math.max(1, wrapperHeight - target.paddingY * 2)
        const scale = clampScale(
            Math.min(availableWidth / target.rect.width, availableHeight / target.rect.height, target.maxScale)
        )
        const centerX = target.rect.x + target.rect.width / 2
        const centerY = target.rect.y + target.rect.height / 2
        const scroll = getScrollForContentPointAtScale(centerX, centerY, scale)

        return {
            scale,
            left: scroll.left,
            top: scroll.top
        }
    }

    function clearActiveFocus() {
        activeFocusTarget = null
    }

    function scheduleDimensionSync() {
        if (pendingDimensionSyncFrame) {
            cancelAnimationFrame(pendingDimensionSyncFrame)
        }

        pendingDimensionSyncFrame = requestAnimationFrame(() => {
            pendingDimensionSyncFrame = undefined
            syncToDimensions()
        })
    }

    function cancelViewAnimation() {
        viewAnimationRequestId += 1
        if (viewAnimationFrame) {
            cancelAnimationFrame(viewAnimationFrame)
            viewAnimationFrame = undefined
        }
    }

    function animateViewTo(targetScale: number, targetLeft: number, targetTop: number) {
        if (!scroller) {
            return
        }

        cancelViewAnimation()
        const requestId = viewAnimationRequestId
        const startScale = currentScale
        const startLeft = scroller.scrollLeft
        const startTop = scroller.scrollTop
        let startedAt: number | null = null

        const step = (now: number) => {
            if (requestId !== viewAnimationRequestId || !scroller) {
                viewAnimationFrame = undefined
                return
            }

            if (startedAt === null) {
                startedAt = now
            }

            const elapsed = Math.min(1, (now - startedAt) / VIEW_ANIMATION_MS)
            const eased = easeInOutCubic(elapsed)
            const nextScale = startScale + (targetScale - startScale) * eased
            const metrics = applyLayout(nextScale)

            scroller.scrollLeft = clamp(
                startLeft + (targetLeft - startLeft) * eased,
                0,
                metrics.maxLeft
            )
            scroller.scrollTop = clamp(startTop + (targetTop - startTop) * eased, 0, metrics.maxTop)

            if (elapsed < 1) {
                viewAnimationFrame = requestAnimationFrame(step)
                return
            }

            const finalMetrics = applyLayout(targetScale)
            scroller.scrollLeft = clamp(targetLeft, 0, finalMetrics.maxLeft)
            scroller.scrollTop = clamp(targetTop, 0, finalMetrics.maxTop)
            viewAnimationFrame = undefined
        }

        viewAnimationFrame = requestAnimationFrame(step)
    }

    function zoomToScaleKeepingCenter(scale: number, animate = false) {
        if (!scroller || !contentWidth || !contentHeight) {
            return
        }

        clearActiveFocus()
        const targetScale = clampScale(scale)
        const centerPoint = initialized
            ? getViewportCenterContentPoint()
            : { x: contentWidth / 2, y: contentHeight / 2 }
        const targetScroll = getScrollForContentPointAtScale(centerPoint.x, centerPoint.y, targetScale)

        if (animate) {
            animateViewTo(targetScale, targetScroll.left, targetScroll.top)
            return
        }

        cancelViewAnimation()
        applyLayout(targetScale)
        scroller.scrollLeft = targetScroll.left
        scroller.scrollTop = targetScroll.top
    }

    function syncToDimensions() {
        if (!wrapperWidth || !wrapperHeight || !contentWidth || !contentHeight || !scroller) {
            return
        }

        syncingView = true
        try {
            const nextBaseScale = computeFitScale()
            const previousBaseScale = baseScale
            const wasAtFitScale = initialized && Math.abs(currentScale - baseScale) < EPSILON
            const centerPoint = initialized
                ? getViewportCenterContentPoint()
                : { x: contentWidth / 2, y: contentHeight / 2 }

            baseScale = nextBaseScale
            updateDiscreteLevels(nextBaseScale)

            if (activeFocusTarget) {
                const targetView = getViewForFocusTarget(activeFocusTarget)
                cancelViewAnimation()
                applyLayout(targetView.scale)
                scroller.scrollLeft = targetView.left
                scroller.scrollTop = targetView.top
                initialized = true
                return
            }

            const targetScale =
                !initialized || wasAtFitScale || Math.abs(currentScale - previousBaseScale) < EPSILON
                    ? nextBaseScale
                    : clampScale(currentScale)
            const targetScroll = getScrollForContentPointAtScale(centerPoint.x, centerPoint.y, targetScale)

            cancelViewAnimation()
            applyLayout(targetScale)
            scroller.scrollLeft = targetScroll.left
            scroller.scrollTop = targetScroll.top
            initialized = true
        } finally {
            syncingView = false
        }
    }

    function getDiscreteScaleStep() {
        if (zoomLevels <= 0) {
            return 0
        }

        return (1 - baseScale) / zoomLevels
    }

    function getNextDiscreteScale(direction: 'in' | 'out') {
        const step = getDiscreteScaleStep()
        if (step <= 0) {
            return null
        }

        const rawPosition = (currentScale - baseScale) / step
        const nearest = Math.round(rawPosition)
        const isOnDiscrete = Math.abs(rawPosition - nearest) < EPSILON

        if (direction === 'in') {
            const index = isOnDiscrete ? nearest + 1 : Math.ceil(rawPosition)
            return index <= zoomLevels ? baseScale + step * index : null
        }

        const index = isOnDiscrete ? nearest - 1 : Math.floor(rawPosition)
        return index >= 0 ? baseScale + step * index : null
    }

    const canZoomIn = $derived(getNextDiscreteScale('in') !== null)
    const canZoomOut = $derived(getNextDiscreteScale('out') !== null)

    function zoomIn() {
        const targetScale = getNextDiscreteScale('in')
        if (targetScale === null) {
            return
        }

        zoomToScaleKeepingCenter(targetScale, true)
    }

    function zoomOut() {
        const targetScale = getNextDiscreteScale('out')
        if (targetScale === null) {
            return
        }

        zoomToScaleKeepingCenter(targetScale, true)
    }

    export function focusRect(rect: FocusRect, options: FocusOptions = {}) {
        const target = normalizeFocusTarget(rect, options)
        activeFocusTarget = target

        if (!scroller || !contentWidth || !contentHeight) {
            return
        }

        const targetView = getViewForFocusTarget(target)

        if (target.animate) {
            animateViewTo(targetView.scale, targetView.left, targetView.top)
            return
        }

        cancelViewAnimation()
        applyLayout(targetView.scale)
        scroller.scrollLeft = targetView.left
        scroller.scrollTop = targetView.top
    }

    function getTouchDistance(touches: TouchList) {
        const first = touches[0]
        const second = touches[1]
        return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)
    }

    function handleTouchStart(event: TouchEvent) {
        if (event.touches.length === 2) {
            cancelViewAnimation()
            pinchDistance = getTouchDistance(event.touches)
        }
    }

    function handleTouchMove(event: TouchEvent) {
        if (pinchDistance === null || event.touches.length !== 2) {
            return
        }

        event.preventDefault()
        const nextDistance = getTouchDistance(event.touches)
        if (pinchDistance > 0) {
            const scaleRatio = Math.pow(nextDistance / pinchDistance, PINCH_ZOOM_SENSITIVITY)
            zoomToScaleKeepingCenter(currentScale * scaleRatio, false)
        }
        pinchDistance = nextDistance
    }

    function handleTouchEnd() {
        pinchDistance = null
    }

    function handleWheel(event: WheelEvent) {
        if (!event.ctrlKey || !contentWidth || !contentHeight) {
            return
        }

        event.preventDefault()
        cancelViewAnimation()
        const nextScale = currentScale * Math.exp(-event.deltaY * 0.0015)
        zoomToScaleKeepingCenter(nextScale, false)
    }

    function handleGestureStart(event: Event) {
        const gestureEvent = event as Event & { scale?: number }
        if (gestureEvent.scale === undefined) {
            return
        }

        event.preventDefault()
        cancelViewAnimation()
        gestureStartScale = currentScale
    }

    function handleGestureChange(event: Event) {
        const gestureEvent = event as Event & { scale?: number }
        if (gestureEvent.scale === undefined || gestureStartScale === null) {
            return
        }

        event.preventDefault()
        zoomToScaleKeepingCenter(
            gestureStartScale * Math.pow(gestureEvent.scale, GESTURE_ZOOM_SENSITIVITY),
            false
        )
    }

    function handleGestureEnd() {
        gestureStartScale = null
    }

    let controlsPosition = $derived.by(() => {
        switch (controls) {
            case 'top-left':
                return 'top-0 left-0'
            case 'top-right':
                return 'top-0 right-0'
            case 'bottom-left':
                return 'bottom-0 left-0'
            case 'bottom-right':
                return 'bottom-0 right-0'
        }
    })

    onDestroy(() => {
        cancelViewAnimation()
        if (pendingDimensionSyncFrame) {
            cancelAnimationFrame(pendingDimensionSyncFrame)
        }
    })

    onMount(() => {
        scheduleDimensionSync()

        if (!scroller) {
            return
        }

        const gestureStartListener = (event: Event) => handleGestureStart(event)
        const gestureChangeListener = (event: Event) => handleGestureChange(event)
        const gestureEndListener = () => handleGestureEnd()

        scroller.addEventListener('gesturestart', gestureStartListener, { passive: false })
        scroller.addEventListener('gesturechange', gestureChangeListener, { passive: false })
        scroller.addEventListener('gestureend', gestureEndListener)

        return () => {
            scroller?.removeEventListener('gesturestart', gestureStartListener)
            scroller?.removeEventListener('gesturechange', gestureChangeListener)
            scroller?.removeEventListener('gestureend', gestureEndListener)
        }
    })
</script>

<div
    bind:this={wrapper}
    bind:clientWidth={wrapperWidth}
    bind:clientHeight={wrapperHeight}
    class="w-full h-full relative"
>
    <div
        bind:this={scroller}
        class="w-full h-full overflow-auto"
        style="touch-action: pan-x pan-y;"
        onwheel={handleWheel}
        ontouchstart={handleTouchStart}
        ontouchmove={handleTouchMove}
        ontouchend={handleTouchEnd}
        ontouchcancel={handleTouchEnd}
    >
        <div bind:this={scrollContent} class="relative min-w-full min-h-full">
            <div
                bind:this={content}
                class="absolute top-0 left-0 box-border will-change-transform"
                style="transform-origin: top left;"
            >
                <div
                    bind:this={measuredContent}
                    bind:clientWidth={contentWidth}
                    bind:clientHeight={contentHeight}
                    class="inline-block box-border"
                >
                    {@render children()}
                </div>
            </div>
        </div>
    </div>
    <div
        class="{zoomLevels > 0 || controls !== 'none'
            ? ''
            : 'hidden'} absolute flex flex-row justify-center items-center {controlsPosition} touch-manipulation bg-black/70 border-gray-700 border-2 px-2 py-1 rounded-lg text-gray-300"
    >
        <button aria-label="Zoom in" onclick={() => zoomIn()}
            ><svg
                class="w-[24px] h-[24px] {canZoomIn ? 'text-gray-300' : 'text-gray-700'}"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="none"
                viewBox="0 0 24 24"
            >
                <path
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-width="2"
                    d="m21 21-3.5-3.5M10 7v6m-3-3h6m4 0a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                ></path>
            </svg>
        </button><button aria-label="Zoom out" onclick={() => zoomOut()} class="ms-2"
            ><svg
                class="w-[24px] h-[24px] {canZoomOut ? 'text-gray-300' : 'text-gray-700'}"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="none"
                viewBox="0 0 24 24"
            >
                <path
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-width="2"
                    d="m21 21-3.5-3.5M7 10h6m4 0a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                ></path>
            </svg>
        </button>
    </div>
</div>
