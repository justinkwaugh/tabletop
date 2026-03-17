<script lang="ts">
    import { onDestroy, onMount, type Snippet } from 'svelte'

    const SCALE_ANIMATION_MS = 180

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

    let {
        children,
        justify = 'center',
        controls = 'top-left'
    }: {
        children: Snippet
        justify?: 'center' | 'left' | 'right'
        controls: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'none'
    } = $props()

    let zoomed = $state(0)
    let zoomLevels = $state(0)
    let baseScale = $state(1)
    let currentScale = $state(1)

    let wrapperWidth = $state(0)
    let wrapperHeight = $state(0)

    let contentWidth = $state(0)
    let contentHeight = $state(0)

    let widthFits = $state(false)
    let scaling = false
    let focusTarget = $state<FocusTarget | null>(null)
    let focusRequestId = 0
    let animateScale = $state(false)
    let animateFocus = false
    let preserveZoomLayout = $state(false)
    let pendingScrollReset = false
    let scaleAnimationTimer: ReturnType<typeof setTimeout> | undefined
    let focusScrollAnimationFrame: number | undefined

    let wrapper: HTMLElement
    let scroller: HTMLElement
    let content: HTMLElement
    let measuredContent: HTMLElement

    $effect(() => {
        // Trigger on contentWidth or contentHeight change
        let newContentWidth = contentWidth
        let newContentHeight = contentHeight
        let currentFocusTarget = focusTarget

        if (!scaling) {
            performScale(wrapperWidth, wrapperHeight)
        }
    })

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

    function triggerScaleAnimation() {
        animateScale = true
        if (scaleAnimationTimer) {
            clearTimeout(scaleAnimationTimer)
        }
        scaleAnimationTimer = setTimeout(() => {
            animateScale = false
            preserveZoomLayout = false
            if (wrapper) {
                performScale(wrapper.clientWidth, wrapper.clientHeight)
            }
            if (pendingScrollReset && scroller) {
                scroller.scrollTop = 0
                scroller.scrollLeft = 0
                pendingScrollReset = false
            }
            scaleAnimationTimer = undefined
        }, SCALE_ANIMATION_MS + 40)
    }

    export function focusRect(rect: FocusRect, options: FocusOptions = {}) {
        focusRequestId += 1
        if (focusScrollAnimationFrame) {
            cancelAnimationFrame(focusScrollAnimationFrame)
            focusScrollAnimationFrame = undefined
        }
        focusTarget = normalizeFocusTarget(rect, options)
        animateFocus = options.animate ?? false
    }

    function easeInOutCubic(t: number) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    }

    function animateFocusScroll(
        startLeft: number,
        startTop: number,
        desiredLeft: number,
        desiredTop: number,
        requestId: number
    ) {
        if (focusScrollAnimationFrame) {
            cancelAnimationFrame(focusScrollAnimationFrame)
        }

        const startedAt = performance.now()

        const step = (now: number) => {
            if (requestId !== focusRequestId || !scroller || !focusTarget) {
                focusScrollAnimationFrame = undefined
                return
            }

            const elapsed = Math.min(1, (now - startedAt) / SCALE_ANIMATION_MS)
            const eased = easeInOutCubic(elapsed)
            const nextLeft = startLeft + (desiredLeft - startLeft) * eased
            const nextTop = startTop + (desiredTop - startTop) * eased
            const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth)
            const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
            scroller.scrollLeft = Math.min(nextLeft, maxLeft)
            scroller.scrollTop = Math.min(nextTop, maxTop)

            if (elapsed < 1) {
                focusScrollAnimationFrame = requestAnimationFrame(step)
            } else {
                focusScrollAnimationFrame = undefined
            }
        }

        focusScrollAnimationFrame = requestAnimationFrame(step)
    }

    function applyFocusScroll(scaleAmt: number, target: FocusTarget, requestId: number) {
        requestAnimationFrame(() => {
            if (requestId !== focusRequestId || !scroller || !focusTarget) {
                return
            }

            const targetCenterX = (target.rect.x + target.rect.width / 2) * scaleAmt
            const targetCenterY = (target.rect.y + target.rect.height / 2) * scaleAmt

            const desiredLeft = Math.max(0, targetCenterX - scroller.clientWidth / 2)
            const desiredTop = Math.max(0, targetCenterY - scroller.clientHeight / 2)

            const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth)
            const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight)

            const nextLeft = Math.min(desiredLeft, maxLeft)
            const nextTop = Math.min(desiredTop, maxTop)

            if (target.animate) {
                animateFocusScroll(
                    scroller.scrollLeft,
                    scroller.scrollTop,
                    desiredLeft,
                    desiredTop,
                    requestId
                )
                return
            }

            scroller.scrollTo({
                left: nextLeft,
                top: nextTop,
                behavior: 'auto'
            })
        })
    }

    function getZoomStep() {
        if (zoomLevels <= 0) {
            return 0
        }

        return (1 - baseScale) / zoomLevels
    }

    function getNextDiscreteZoom(direction: 'in' | 'out'): number | null {
        const step = getZoomStep()
        if (step <= 0) {
            return null
        }

        const rawPosition = (currentScale - baseScale) / step
        const nearest = Math.round(rawPosition)
        const isOnDiscrete = Math.abs(rawPosition - nearest) < 0.001

        if (direction === 'in') {
            const target = isOnDiscrete ? nearest + 1 : Math.ceil(rawPosition)
            return target <= zoomLevels ? target : null
        }

        const target = isOnDiscrete ? nearest - 1 : Math.floor(rawPosition)
        return target >= 0 ? target : null
    }

    const canZoomIn = $derived(getNextDiscreteZoom('in') !== null)
    const canZoomOut = $derived(getNextDiscreteZoom('out') !== null)

    function performScale(wrapperWidth: number, wrapperHeight: number) {
        if (!content || !measuredContent || !scroller || !wrapperWidth || !wrapperHeight) {
            return
        }
        scaling = true
        try {
            const cw = contentWidth
            const ch = contentHeight
            if (!cw || !ch) {
                return
            }

            content.style.transition =
                animateScale || animateFocus ? `transform ${SCALE_ANIMATION_MS}ms ease` : 'none'
            content.style.width = 'fit-content'
            content.style.height = 'fit-content'
            const fitScale = Math.min(wrapperWidth / cw, wrapperHeight / ch)
            let scaleAmt = fitScale

            // Check if the content fits the wrapper width regardless of scale
            widthFits = cw <= wrapperWidth
            baseScale = fitScale

            const scaleRange = 1 - fitScale
            if (fitScale === 1) {
                zoomLevels = 0
                if (!focusTarget) {
                    zoomed = 0
                }
            } else {
                zoomLevels = Math.floor(scaleRange / 0.15)
                if (!focusTarget) {
                    zoomed = Math.min(zoomLevels, zoomed)
                }
            }

            if (focusTarget) {
                const availableWidth = Math.max(1, wrapperWidth - focusTarget.paddingX * 2)
                const availableHeight = Math.max(1, wrapperHeight - focusTarget.paddingY * 2)
                scaleAmt = Math.min(
                    availableWidth / focusTarget.rect.width,
                    availableHeight / focusTarget.rect.height,
                    focusTarget.maxScale
                )
                scaleAmt = Math.max(scaleAmt, 0.01)
                currentScale = scaleAmt
                content.style.transform = `scale(${scaleAmt}, ${scaleAmt})`
                if (scaleAmt < 1) {
                    content.style.width = '0'
                    content.style.height = '0'
                } else {
                    content.style.width = `${cw}px`
                    content.style.height = `${ch}px`
                }
                const requestId = focusRequestId
                applyFocusScroll(scaleAmt, focusTarget, requestId)
                animateFocus = false
                return
            }

            // Apply the scale based on zoom level
            scaleAmt = zoomed && zoomLevels > 0 ? fitScale + (scaleRange / zoomLevels) * zoomed : fitScale
            currentScale = scaleAmt
            content.style.transform = `scale(${scaleAmt}, ${scaleAmt})`

            if (zoomed || preserveZoomLayout) {
                // This is complicated stuff to make the scaled content either centered or left justified...
                const scw = cw * scaleAmt
                if (!widthFits) {
                    // If the scaled width is larger than the wrapper we set the width to 0
                    // in order to make it scroll correctly
                    if (scw > wrapperWidth) {
                        content.style.width = '0'
                    } else {
                        // To center it we have take the difference between the wrapper width and the scaled content width
                        // and multiply it by the reciprocal of the difference between 1 and the scale amount
                        const multiplier = 1 / (1 - scaleAmt)
                        content.style.width = (wrapperWidth - scw) * multiplier + 'px'
                    }
                } else {
                    content.style.width = cw + 'px'
                }

                // We do not want zoomed content to recenter vertically between steps.
                content.style.height = '0'
            } else {
                content.style.width = 'fit-content'
                content.style.height = 'fit-content'
            }
            animateFocus = false
        } finally {
            scaling = false
        }
    }

    let origin = $derived.by(() => {
        if (focusTarget) {
            return 'origin-top-left'
        }
        if (zoomed || preserveZoomLayout) {
            return 'origin-center'
        }
        switch (justify) {
            case 'center':
                return 'origin-top'
            case 'left':
                return 'origin-top-left'
            case 'right':
                return 'origin-top-right'
        }
    })

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

    function zoomIn() {
        const nextZoom = getNextDiscreteZoom('in')
        if (nextZoom === null) {
            return
        }

        triggerScaleAnimation()
        if (focusTarget) {
            focusTarget = null
            focusRequestId += 1
        }
        zoomed = nextZoom
    }

    function zoomOut() {
        const nextZoom = getNextDiscreteZoom('out')
        if (nextZoom === null) {
            return
        }

        triggerScaleAnimation()
        if (focusTarget) {
            focusTarget = null
            focusRequestId += 1
        }

        zoomed = nextZoom
        if (zoomed === 0) {
            preserveZoomLayout = true
            pendingScrollReset = true
        }
    }

    onMount(() => {
        if (!wrapper) return
        setTimeout(() => performScale(wrapper.clientWidth, wrapper.clientHeight), 100)
    })

    onDestroy(() => {
        if (scaleAnimationTimer) {
            clearTimeout(scaleAnimationTimer)
        }
        if (focusScrollAnimationFrame) {
            cancelAnimationFrame(focusScrollAnimationFrame)
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
        class="w-full h-full flex {focusTarget
            ? 'overflow-auto justify-start'
            : zoomed || preserveZoomLayout
            ? 'overflow-auto justify-' + (widthFits ? justify : 'start')
            : 'overflow-hidden justify-' + justify}"
    >
        <div
            bind:this={content}
            class="{origin} box-border"
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
    <div
        class="{zoomLevels > 0 || controls !== 'none'
            ? ''
            : 'hidden'} absolute flex flex-row justify-center items-center {controlsPosition} bg-black/70 border-gray-700 border-2 px-2 py-1 rounded-lg text-gray-300"
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
