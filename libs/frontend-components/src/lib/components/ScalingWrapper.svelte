<script lang="ts">
    import { onDestroy, onMount, type Snippet } from 'svelte'

    const DISCRETE_ZOOM_STEP = 0.15
    const VIEW_ANIMATION_MS = 180
    const EPSILON = 0.001
    const PINCH_ZOOM_SENSITIVITY = 1
    const GESTURE_ZOOM_SENSITIVITY = 1.2
    const TOUCH_INERTIA_DECAY_PER_FRAME = 0.92
    const TOUCH_INERTIA_MIN_VELOCITY = 0.02
    const TOUCH_INERTIA_MAX_VELOCITY = 2.5

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

    type FitOptions = {
        animate?: boolean
    }

    type FocusTarget = {
        rect: FocusRect
        maxScale: number
        paddingX: number
        paddingY: number
        animate: boolean
    }

    type Point = {
        x: number
        y: number
    }

    type ViewMetrics = {
        scale: number
        scaledWidth: number
        scaledHeight: number
        minTranslateX: number
        maxTranslateX: number
        minTranslateY: number
        maxTranslateY: number
        defaultTranslateX: number
        defaultTranslateY: number
    }

    let {
        children,
        justify = 'center',
        controls = 'top-left',
        expandable = false
    }: {
        children: Snippet
        justify?: 'center' | 'left' | 'right'
        controls: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'none'
        expandable?: boolean
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
    let content: HTMLElement
    let measuredContent: HTMLElement

    let initialized = false
    let syncingView = false
    let activeFocusTarget = $state<FocusTarget | null>(null)
    let viewAnimationFrame: number | undefined
    let pendingDimensionSyncFrame: number | undefined
    let viewAnimationRequestId = 0
    let currentTranslateX = $state(0)
    let currentTranslateY = $state(0)
    let isExpanded = $state(false)
    let pinchDistance: number | null = null
    let pinchStartDistance: number | null = null
    let pinchStartScale: number | null = null
    let pinchAnchorContentPoint: Point | null = null
    let pinchLatestMidpoint: Point | null = null
    let pinchAnimationFrame: number | undefined
    let panLastClientPoint: Point | null = null
    let panLastTimestamp: number | null = null
    let panVelocityX = 0
    let panVelocityY = 0
    let panInertiaFrame: number | undefined
    let scrollVelocityX = 0
    let scrollVelocityY = 0
    let scrollInertiaFrame: number | undefined
    let gestureStartScale: number | null = null

    $effect(() => {
        wrapperWidth
        wrapperHeight
        contentWidth
        contentHeight

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
        const defaultTranslateX = getOffsetX(scaledWidth)
        const defaultTranslateY = 0
        const minTranslateX = scaledWidth > wrapperWidth ? wrapperWidth - scaledWidth : defaultTranslateX
        const maxTranslateX = scaledWidth > wrapperWidth ? 0 : defaultTranslateX
        const minTranslateY = scaledHeight > wrapperHeight ? wrapperHeight - scaledHeight : defaultTranslateY
        const maxTranslateY = scaledHeight > wrapperHeight ? 0 : defaultTranslateY

        return {
            scale: clampedScale,
            scaledWidth,
            scaledHeight,
            minTranslateX,
            maxTranslateX,
            minTranslateY,
            maxTranslateY,
            defaultTranslateX,
            defaultTranslateY
        }
    }

    function clampTranslation(scale: number, translateX: number, translateY: number) {
        const metrics = getMetrics(scale)

        return {
            metrics,
            translateX: clamp(translateX, metrics.minTranslateX, metrics.maxTranslateX),
            translateY: clamp(translateY, metrics.minTranslateY, metrics.maxTranslateY)
        }
    }

    function applyView(scale: number, translateX: number, translateY: number) {
        const { metrics, translateX: clampedTranslateX, translateY: clampedTranslateY } =
            clampTranslation(scale, translateX, translateY)

        currentScale = metrics.scale
        currentTranslateX = clampedTranslateX
        currentTranslateY = clampedTranslateY

        if (content && contentWidth && contentHeight) {
            content.style.transform = `translate(${clampedTranslateX}px, ${clampedTranslateY}px) scale(${metrics.scale})`
        }

        return {
            scale: metrics.scale,
            translateX: clampedTranslateX,
            translateY: clampedTranslateY,
            metrics
        }
    }

    function findScrollableAncestor(element: HTMLElement | null): HTMLElement | null {
        let current = element?.parentElement ?? null
        while (current) {
            const style = getComputedStyle(current)
            const canScrollX =
                /(auto|scroll|overlay)/.test(style.overflowX) && current.scrollWidth > current.clientWidth
            const canScrollY =
                /(auto|scroll|overlay)/.test(style.overflowY) && current.scrollHeight > current.clientHeight
            if (canScrollX || canScrollY) {
                return current
            }
            current = current.parentElement
        }

        return null
    }

    function scrollAncestorBy(deltaX: number, deltaY: number) {
        const scrollAncestor = findScrollableAncestor(scroller)
        if (scrollAncestor) {
            const startLeft = scrollAncestor.scrollLeft
            const startTop = scrollAncestor.scrollTop
            scrollAncestor.scrollLeft -= deltaX
            scrollAncestor.scrollTop -= deltaY
            return {
                movedX: scrollAncestor.scrollLeft - startLeft,
                movedY: scrollAncestor.scrollTop - startTop
            }
        }

        const startX = window.scrollX
        const startY = window.scrollY
        window.scrollBy({
            left: -deltaX,
            top: -deltaY,
            behavior: 'auto'
        })

        return {
            movedX: window.scrollX - startX,
            movedY: window.scrollY - startY
        }
    }

    function getViewportCenterContentPoint() {
        return {
            x: clamp((wrapperWidth / 2 - currentTranslateX) / currentScale, 0, contentWidth),
            y: clamp((wrapperHeight / 2 - currentTranslateY) / currentScale, 0, contentHeight)
        }
    }

    function getViewForContentPointAtViewportPoint(
        contentX: number,
        contentY: number,
        viewportX: number,
        viewportY: number,
        scale: number
    ) {
        const metrics = getMetrics(scale)
        return {
            scale: metrics.scale,
            translateX: clamp(
                viewportX - contentX * metrics.scale,
                metrics.minTranslateX,
                metrics.maxTranslateX
            ),
            translateY: clamp(
                viewportY - contentY * metrics.scale,
                metrics.minTranslateY,
                metrics.maxTranslateY
            )
        }
    }

    function getContentPointForClientPoint(clientX: number, clientY: number) {
        const rect = scroller.getBoundingClientRect()
        const viewportX = clientX - rect.left
        const viewportY = clientY - rect.top

        return {
            x: clamp((viewportX - currentTranslateX) / currentScale, 0, contentWidth),
            y: clamp((viewportY - currentTranslateY) / currentScale, 0, contentHeight)
        }
    }

    function getViewForFocusTarget(target: FocusTarget) {
        const availableWidth = Math.max(1, wrapperWidth - target.paddingX * 2)
        const availableHeight = Math.max(1, wrapperHeight - target.paddingY * 2)
        const scale = clampScale(
            Math.min(
                availableWidth / target.rect.width,
                availableHeight / target.rect.height,
                target.maxScale
            )
        )
        const centerX = target.rect.x + target.rect.width / 2
        const centerY = target.rect.y + target.rect.height / 2

        return getViewForContentPointAtViewportPoint(
            centerX,
            centerY,
            wrapperWidth / 2,
            wrapperHeight / 2,
            scale
        )
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

    function cancelPinchAnimation() {
        if (pinchAnimationFrame) {
            cancelAnimationFrame(pinchAnimationFrame)
            pinchAnimationFrame = undefined
        }
    }

    function cancelPanInertia() {
        if (panInertiaFrame) {
            cancelAnimationFrame(panInertiaFrame)
            panInertiaFrame = undefined
        }
    }

    function cancelScrollInertia() {
        if (scrollInertiaFrame) {
            cancelAnimationFrame(scrollInertiaFrame)
            scrollInertiaFrame = undefined
        }
    }

    function startPanInertia() {
        cancelPanInertia()

        if (
            Math.abs(panVelocityX) < TOUCH_INERTIA_MIN_VELOCITY &&
            Math.abs(panVelocityY) < TOUCH_INERTIA_MIN_VELOCITY
        ) {
            panVelocityX = 0
            panVelocityY = 0
            return
        }

        let lastTimestamp: number | null = null

        const step = (timestamp: number) => {
            if (lastTimestamp === null) {
                lastTimestamp = timestamp
                panInertiaFrame = requestAnimationFrame(step)
                return
            }

            const deltaMs = Math.max(1, timestamp - lastTimestamp)
            lastTimestamp = timestamp
            const decay = Math.pow(TOUCH_INERTIA_DECAY_PER_FRAME, deltaMs / (1000 / 60))
            const nextView = clampTranslation(
                currentScale,
                currentTranslateX + panVelocityX * deltaMs,
                currentTranslateY + panVelocityY * deltaMs
            )
            const movedX = Math.abs(nextView.translateX - currentTranslateX) > EPSILON
            const movedY = Math.abs(nextView.translateY - currentTranslateY) > EPSILON

            if (movedX || movedY) {
                applyView(currentScale, nextView.translateX, nextView.translateY)
            }

            panVelocityX = movedX ? panVelocityX * decay : 0
            panVelocityY = movedY ? panVelocityY * decay : 0

            if (
                Math.abs(panVelocityX) < TOUCH_INERTIA_MIN_VELOCITY &&
                Math.abs(panVelocityY) < TOUCH_INERTIA_MIN_VELOCITY
            ) {
                panVelocityX = 0
                panVelocityY = 0
                panInertiaFrame = undefined
                return
            }

            panInertiaFrame = requestAnimationFrame(step)
        }

        panInertiaFrame = requestAnimationFrame(step)
    }

    function startScrollInertia() {
        cancelScrollInertia()

        if (
            Math.abs(scrollVelocityX) < TOUCH_INERTIA_MIN_VELOCITY &&
            Math.abs(scrollVelocityY) < TOUCH_INERTIA_MIN_VELOCITY
        ) {
            scrollVelocityX = 0
            scrollVelocityY = 0
            return
        }

        let lastTimestamp: number | null = null

        const step = (timestamp: number) => {
            if (lastTimestamp === null) {
                lastTimestamp = timestamp
                scrollInertiaFrame = requestAnimationFrame(step)
                return
            }

            const deltaMs = Math.max(1, timestamp - lastTimestamp)
            lastTimestamp = timestamp
            const decay = Math.pow(TOUCH_INERTIA_DECAY_PER_FRAME, deltaMs / (1000 / 60))
            const movement = scrollAncestorBy(
                scrollVelocityX * deltaMs,
                scrollVelocityY * deltaMs
            )
            const movedX = Math.abs(movement.movedX) > EPSILON
            const movedY = Math.abs(movement.movedY) > EPSILON

            scrollVelocityX = movedX ? scrollVelocityX * decay : 0
            scrollVelocityY = movedY ? scrollVelocityY * decay : 0

            if (
                Math.abs(scrollVelocityX) < TOUCH_INERTIA_MIN_VELOCITY &&
                Math.abs(scrollVelocityY) < TOUCH_INERTIA_MIN_VELOCITY
            ) {
                scrollVelocityX = 0
                scrollVelocityY = 0
                scrollInertiaFrame = undefined
                return
            }

            scrollInertiaFrame = requestAnimationFrame(step)
        }

        scrollInertiaFrame = requestAnimationFrame(step)
    }

    function animateViewTo(targetScale: number, targetLeft: number, targetTop: number) {
        if (!content) {
            return
        }

        cancelViewAnimation()
        const requestId = viewAnimationRequestId
        const startScale = currentScale
        const startLeft = currentTranslateX
        const startTop = currentTranslateY
        let startedAt: number | null = null

        const step = (now: number) => {
            if (requestId !== viewAnimationRequestId || !content) {
                viewAnimationFrame = undefined
                return
            }

            if (startedAt === null) {
                startedAt = now
            }

            const elapsed = Math.min(1, (now - startedAt) / VIEW_ANIMATION_MS)
            const eased = easeInOutCubic(elapsed)
            const nextScale = startScale + (targetScale - startScale) * eased
            const nextLeft = startLeft + (targetLeft - startLeft) * eased
            const nextTop = startTop + (targetTop - startTop) * eased
            applyView(nextScale, nextLeft, nextTop)

            if (elapsed < 1) {
                viewAnimationFrame = requestAnimationFrame(step)
                return
            }

            applyView(targetScale, targetLeft, targetTop)
            viewAnimationFrame = undefined
        }

        viewAnimationFrame = requestAnimationFrame(step)
    }

    function zoomToScaleKeepingCenter(scale: number, animate = false) {
        if (!scroller || !contentWidth || !contentHeight) {
            return
        }

        const targetScale = clampScale(scale)
        const centerPoint = initialized
            ? getViewportCenterContentPoint()
            : { x: contentWidth / 2, y: contentHeight / 2 }

        zoomToScaleKeepingContentPoint(centerPoint.x, centerPoint.y, targetScale, animate)
    }

    function zoomToScaleKeepingContentPoint(
        contentX: number,
        contentY: number,
        scale: number,
        animate = false
    ) {
        if (!contentWidth || !contentHeight) {
            return
        }

        clearActiveFocus()
        const targetView = getViewForContentPointAtViewportPoint(
            contentX,
            contentY,
            wrapperWidth / 2,
            wrapperHeight / 2,
            scale
        )

        if (animate) {
            animateViewTo(targetView.scale, targetView.translateX, targetView.translateY)
            return
        }

        cancelViewAnimation()
        applyView(targetView.scale, targetView.translateX, targetView.translateY)
    }

    function syncToDimensions() {
        if (!wrapperWidth || !wrapperHeight || !contentWidth || !contentHeight) {
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
                applyView(targetView.scale, targetView.translateX, targetView.translateY)
                initialized = true
                return
            }

            const targetScale =
                !initialized || wasAtFitScale || Math.abs(currentScale - previousBaseScale) < EPSILON
                    ? nextBaseScale
                    : clampScale(currentScale)
            const targetView = getViewForContentPointAtViewportPoint(
                centerPoint.x,
                centerPoint.y,
                wrapperWidth / 2,
                wrapperHeight / 2,
                targetScale
            )

            cancelViewAnimation()
            applyView(targetView.scale, targetView.translateX, targetView.translateY)
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

    function setExpanded(nextExpanded: boolean) {
        isExpanded = nextExpanded
        requestAnimationFrame(() => {
            scheduleDimensionSync()
        })
    }

    export function expand() {
        setExpanded(true)
    }

    export function collapse() {
        setExpanded(false)
    }

    export function toggleExpanded() {
        setExpanded(!isExpanded)
    }

    export function fitToContent(options: FitOptions = {}) {
        clearActiveFocus()

        if (!contentWidth || !contentHeight) {
            return
        }

        const targetView = getViewForContentPointAtViewportPoint(
            contentWidth / 2,
            contentHeight / 2,
            wrapperWidth / 2,
            wrapperHeight / 2,
            baseScale
        )

        if (options.animate) {
            animateViewTo(targetView.scale, targetView.translateX, targetView.translateY)
            return
        }

        cancelViewAnimation()
        applyView(targetView.scale, targetView.translateX, targetView.translateY)
    }

    export function focusRect(rect: FocusRect, options: FocusOptions = {}) {
        const target = normalizeFocusTarget(rect, options)
        activeFocusTarget = target

        if (!contentWidth || !contentHeight) {
            return
        }

        const targetView = getViewForFocusTarget(target)

        if (target.animate) {
            animateViewTo(targetView.scale, targetView.translateX, targetView.translateY)
            return
        }

        cancelViewAnimation()
        applyView(targetView.scale, targetView.translateX, targetView.translateY)
    }

    function getTouchDistance(touches: TouchList) {
        const first = touches[0]
        const second = touches[1]
        return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)
    }

    function getTouchMidpoint(touches: TouchList) {
        const first = touches[0]
        const second = touches[1]
        return {
            x: (first.clientX + second.clientX) / 2,
            y: (first.clientY + second.clientY) / 2
        }
    }

    function queuePinchUpdate() {
        if (pinchAnimationFrame || pinchStartDistance === null || pinchStartScale === null) {
            return
        }

        pinchAnimationFrame = requestAnimationFrame(() => {
            pinchAnimationFrame = undefined

            if (
                !scroller ||
                !contentWidth ||
                !contentHeight ||
                pinchStartDistance === null ||
                pinchStartScale === null ||
                pinchDistance === null ||
                pinchLatestMidpoint === null ||
                pinchAnchorContentPoint === null
            ) {
                return
            }

            if (pinchStartDistance <= 0) {
                return
            }

            const targetScale =
                pinchStartScale * Math.pow(pinchDistance / pinchStartDistance, PINCH_ZOOM_SENSITIVITY)
            const rect = scroller.getBoundingClientRect()
            const viewportX = pinchLatestMidpoint.x - rect.left
            const viewportY = pinchLatestMidpoint.y - rect.top
            const targetView = getViewForContentPointAtViewportPoint(
                pinchAnchorContentPoint.x,
                pinchAnchorContentPoint.y,
                viewportX,
                viewportY,
                targetScale
            )

            cancelViewAnimation()
            clearActiveFocus()
            applyView(targetView.scale, targetView.translateX, targetView.translateY)
        })
    }

    function handleTouchStart(event: TouchEvent) {
        if (event.touches.length === 2) {
            cancelViewAnimation()
            cancelPinchAnimation()
            cancelPanInertia()
            cancelScrollInertia()
            panLastClientPoint = null
            panLastTimestamp = null
            panVelocityX = 0
            panVelocityY = 0
            scrollVelocityX = 0
            scrollVelocityY = 0
            const midpoint = getTouchMidpoint(event.touches)
            pinchDistance = getTouchDistance(event.touches)
            pinchStartDistance = pinchDistance
            pinchStartScale = currentScale
            pinchLatestMidpoint = midpoint
            pinchAnchorContentPoint = getContentPointForClientPoint(midpoint.x, midpoint.y)
            return
        }

        if (event.touches.length === 1) {
            cancelViewAnimation()
            cancelPinchAnimation()
            cancelPanInertia()
            cancelScrollInertia()
            panLastClientPoint = {
                x: event.touches[0].clientX,
                y: event.touches[0].clientY
            }
            panLastTimestamp = event.timeStamp
            panVelocityX = 0
            panVelocityY = 0
            scrollVelocityX = 0
            scrollVelocityY = 0
        }
    }

    function handleTouchMove(event: TouchEvent) {
        if (event.touches.length === 2 && pinchDistance !== null) {
            event.preventDefault()
            pinchDistance = getTouchDistance(event.touches)
            pinchLatestMidpoint = getTouchMidpoint(event.touches)
            queuePinchUpdate()
            return
        }

        if (event.touches.length !== 1 || !panLastClientPoint) {
            return
        }

        event.preventDefault()
        const touch = event.touches[0]
        const nextPoint = { x: touch.clientX, y: touch.clientY }
        const deltaX = nextPoint.x - panLastClientPoint.x
        const deltaY = nextPoint.y - panLastClientPoint.y
        const deltaMs =
            panLastTimestamp === null ? 16 : Math.max(1, event.timeStamp - panLastTimestamp)
        panLastClientPoint = nextPoint
        panLastTimestamp = event.timeStamp
        const nextView = clampTranslation(
            currentScale,
            currentTranslateX + deltaX,
            currentTranslateY + deltaY
        )
        const didPan =
            Math.abs(nextView.translateX - currentTranslateX) > EPSILON ||
            Math.abs(nextView.translateY - currentTranslateY) > EPSILON
        event.preventDefault()
        if (didPan) {
            cancelViewAnimation()
            applyView(currentScale, nextView.translateX, nextView.translateY)
            const nextVelocityX = clamp(
                deltaX / deltaMs,
                -TOUCH_INERTIA_MAX_VELOCITY,
                TOUCH_INERTIA_MAX_VELOCITY
            )
            const nextVelocityY = clamp(
                deltaY / deltaMs,
                -TOUCH_INERTIA_MAX_VELOCITY,
                TOUCH_INERTIA_MAX_VELOCITY
            )
            panVelocityX = panVelocityX * 0.35 + nextVelocityX * 0.65
            panVelocityY = panVelocityY * 0.35 + nextVelocityY * 0.65
            scrollVelocityX = 0
            scrollVelocityY = 0
            return
        }

        panVelocityX = 0
        panVelocityY = 0
        const movement = scrollAncestorBy(deltaX, deltaY)
        const didScroll = Math.abs(movement.movedX) > EPSILON || Math.abs(movement.movedY) > EPSILON
        if (!didScroll) {
            scrollVelocityX = 0
            scrollVelocityY = 0
            return
        }

        const nextVelocityX = clamp(
            deltaX / deltaMs,
            -TOUCH_INERTIA_MAX_VELOCITY,
            TOUCH_INERTIA_MAX_VELOCITY
        )
        const nextVelocityY = clamp(
            deltaY / deltaMs,
            -TOUCH_INERTIA_MAX_VELOCITY,
            TOUCH_INERTIA_MAX_VELOCITY
        )
        scrollVelocityX = scrollVelocityX * 0.35 + nextVelocityX * 0.65
        scrollVelocityY = scrollVelocityY * 0.35 + nextVelocityY * 0.65
    }

    function clearPinchState() {
        pinchDistance = null
        pinchStartDistance = null
        pinchStartScale = null
        pinchAnchorContentPoint = null
        pinchLatestMidpoint = null
        cancelPinchAnimation()
    }

    function handleTouchEnd(event: TouchEvent) {
        if (event.touches.length < 2) {
            clearPinchState()
        }

        if (event.touches.length === 1) {
            panLastClientPoint = {
                x: event.touches[0].clientX,
                y: event.touches[0].clientY
            }
            panLastTimestamp = event.timeStamp
            return
        }

        if (panLastClientPoint) {
            startPanInertia()
        } else {
            panVelocityX = 0
            panVelocityY = 0
        }
        startScrollInertia()
        panLastClientPoint = null
        panLastTimestamp = null
    }

    function handleWheel(event: WheelEvent) {
        if (!contentWidth || !contentHeight) {
            return
        }

        if (event.ctrlKey) {
            event.preventDefault()
            cancelViewAnimation()
            const nextScale = currentScale * Math.exp(-event.deltaY * 0.003)
            const contentPoint = getContentPointForClientPoint(event.clientX, event.clientY)
            const rect = scroller.getBoundingClientRect()
            const viewportX = event.clientX - rect.left
            const viewportY = event.clientY - rect.top
            const targetView = getViewForContentPointAtViewportPoint(
                contentPoint.x,
                contentPoint.y,
                viewportX,
                viewportY,
                nextScale
            )
            applyView(targetView.scale, targetView.translateX, targetView.translateY)
            return
        }

        const metrics = getMetrics(currentScale)
        const canPan =
            metrics.minTranslateX !== metrics.maxTranslateX || metrics.minTranslateY !== metrics.maxTranslateY
        if (!canPan) {
            return
        }

        const nextView = clampTranslation(
            currentScale,
            currentTranslateX - event.deltaX,
            currentTranslateY - event.deltaY
        )
        const didPan =
            Math.abs(nextView.translateX - currentTranslateX) > EPSILON ||
            Math.abs(nextView.translateY - currentTranslateY) > EPSILON
        if (!didPan) {
            return
        }

        event.preventDefault()
        cancelViewAnimation()
        applyView(currentScale, nextView.translateX, nextView.translateY)
    }

    function handleGestureStart(event: Event) {
        if (pinchDistance !== null) {
            return
        }

        const gestureEvent = event as Event & { scale?: number }
        if (gestureEvent.scale === undefined) {
            return
        }

        event.preventDefault()
        cancelViewAnimation()
        gestureStartScale = currentScale
    }

    function handleGestureChange(event: Event) {
        if (pinchDistance !== null) {
            return
        }

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
        cancelPinchAnimation()
        cancelPanInertia()
        cancelScrollInertia()
        if (typeof document !== 'undefined') {
            document.body.style.overflow = ''
            document.documentElement.style.overflow = ''
        }
        if (pendingDimensionSyncFrame) {
            cancelAnimationFrame(pendingDimensionSyncFrame)
        }
    })

    $effect(() => {
        if (typeof document === 'undefined') {
            return
        }

        if (isExpanded) {
            document.body.style.overflow = 'hidden'
            document.documentElement.style.overflow = 'hidden'

            return () => {
                document.body.style.overflow = ''
                document.documentElement.style.overflow = ''
            }
        }

        document.body.style.overflow = ''
        document.documentElement.style.overflow = ''
    })

    onMount(() => {
        scheduleDimensionSync()

        if (!scroller) {
            return
        }

        const touchStartListener = (event: TouchEvent) => handleTouchStart(event)
        const touchMoveListener = (event: TouchEvent) => handleTouchMove(event)
        const touchEndListener = (event: TouchEvent) => handleTouchEnd(event)
        const gestureStartListener = (event: Event) => handleGestureStart(event)
        const gestureChangeListener = (event: Event) => handleGestureChange(event)
        const gestureEndListener = () => handleGestureEnd()

        scroller.addEventListener('touchstart', touchStartListener, { passive: false })
        scroller.addEventListener('touchmove', touchMoveListener, { passive: false })
        scroller.addEventListener('touchend', touchEndListener, { passive: false })
        scroller.addEventListener('touchcancel', touchEndListener, { passive: false })
        scroller.addEventListener('gesturestart', gestureStartListener, { passive: false })
        scroller.addEventListener('gesturechange', gestureChangeListener, { passive: false })
        scroller.addEventListener('gestureend', gestureEndListener)

        return () => {
            scroller?.removeEventListener('touchstart', touchStartListener)
            scroller?.removeEventListener('touchmove', touchMoveListener)
            scroller?.removeEventListener('touchend', touchEndListener)
            scroller?.removeEventListener('touchcancel', touchEndListener)
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
    class="relative overflow-hidden"
    class:w-full={!isExpanded}
    class:h-full={!isExpanded}
    style={isExpanded
        ? 'position: fixed; inset: 0; z-index: 9999; background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(1px);'
        : undefined}
>
    <div
        bind:this={scroller}
        class="overflow-hidden"
        class:w-full={!isExpanded}
        class:h-full={!isExpanded}
        style={`${isExpanded ? 'width: 100vw; height: 100dvh; padding: 8px;' : ''} touch-action: none;`}
        onwheel={handleWheel}
    >
        <div class="relative w-full h-full">
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
            ? isExpanded
                ? 'm-2'
                : ''
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
        {#if expandable}
            <button
                aria-label={isExpanded ? 'Exit full screen' : 'Enter full screen'}
                onclick={() => toggleExpanded()}
                class="ms-2"
            >
                <svg
                    class="w-[24px] h-[24px] text-gray-300"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    {#if isExpanded}
                        <path
                            stroke="currentColor"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M9 9 4.5 4.5M9 9V5.25M9 9H5.25M15 9l4.5-4.5M15 9h3.75M15 9V5.25M9 15l-4.5 4.5M9 15H5.25M9 15v3.75M15 15l4.5 4.5M15 15h3.75M15 15v3.75"
                        ></path>
                    {:else}
                        <path
                            stroke="currentColor"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4.5 9V4.5M4.5 4.5H9M4.5 4.5 9.75 9.75M19.5 9V4.5M19.5 4.5H15M19.5 4.5 14.25 9.75M4.5 15v4.5M4.5 19.5H9M4.5 19.5l5.25-5.25M19.5 15v4.5M19.5 19.5H15M19.5 19.5l-5.25-5.25"
                        ></path>
                    {/if}
                </svg>
            </button>
        {/if}
    </div>
</div>
