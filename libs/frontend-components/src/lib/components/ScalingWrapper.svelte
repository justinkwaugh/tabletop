<script lang="ts">
    import { onMount, type Snippet } from 'svelte'

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

    let wrapperWidth = $state(0)
    let wrapperHeight = $state(0)

    let widthFits = $state(false)

    let wrapper: HTMLElement
    let scroller: HTMLElement
    let content: HTMLElement

    $effect(() => {
        performScale(wrapperWidth, wrapperHeight)
    })

    function performScale(wrapperWidth: number, wrapperHeight: number) {
        // Get the scaled content, and reset its scaling for an instant
        content.style.transform = 'scale(1, 1)'
        content.style.height = 'fit-content'
        content.style.width = 'fit-content'

        let { width: cw, height: ch } = content.getBoundingClientRect()
        let scaleAmt = Math.min(wrapperWidth / cw, wrapperHeight / ch)

        // Check if the content fits the wrapper width regardless of scale
        widthFits = cw <= wrapperWidth

        // For zooming we scale the content in 15% increments, so we figure out
        // how many increments we can fit in the range between 1 and the scale amount
        let scaleRange = 1 - scaleAmt
        if (scaleAmt === 1) {
            zoomed = 0
            zoomLevels = 0
        } else {
            zoomLevels = Math.floor(scaleRange / 0.15)
            zoomed = Math.min(zoomLevels, zoomed)
        }

        // Apply the scale based on zoom level
        scaleAmt = zoomed ? scaleAmt + (scaleRange / zoomLevels) * zoomed : scaleAmt
        content.style.transform = `scale(${scaleAmt}, ${scaleAmt})`

        if (zoomed) {
            // This is complicated stuff to make the scaled content either centered or left justified...
            let { width: scw, height: sch } = content.getBoundingClientRect()
            if (scaleAmt < 1 && !widthFits) {
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

            // We do not want to center the height
            if (scaleAmt < 1) {
                content.style.height = '0'
            }
        }
    }

    let origin = $derived.by(() => {
        if (zoomed) {
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
        if (zoomed < zoomLevels) {
            zoomed += 1
        }
    }

    function zoomOut() {
        if (zoomed > 0) {
            zoomed -= 1
            if (zoomed === 0) {
                scroller.scrollTop = 0
                scroller.scrollLeft = 0
            }
        }
    }

    onMount(() => {
        setTimeout(() => performScale(wrapper.clientWidth, wrapper.clientHeight), 0)
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
        class="w-full h-full flex {zoomed
            ? 'overflow-auto justify-' + (widthFits ? justify : 'start')
            : 'overflow-hidden justify-' + justify}"
    >
        <div bind:this={content} class="{origin} box-border">
            {@render children()}
        </div>
    </div>
    <div
        class="{zoomLevels > 0 || controls !== 'none'
            ? ''
            : 'hidden'} absolute flex flex-row justify-center items-center {controlsPosition} bg-black bg-opacity-70 border-gray-700 border-2 px-2 py-1 rounded-lg text-gray-300"
    >
        <button onclick={() => zoomIn()}
            ><svg
                class="w-[24px] h-[24px] {zoomed < zoomLevels ? 'text-gray-300' : 'text-gray-700'}"
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
        </button><button onclick={() => zoomOut()} class="ms-2"
            ><svg
                class="w-[24px] h-[24px] {zoomed > 0 ? 'text-gray-300' : 'text-gray-700'}"
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
