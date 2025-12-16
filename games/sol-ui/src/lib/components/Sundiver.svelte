<script lang="ts">
    import SundiverIcon from '$lib/images/sundiver.svelte'
    import SundiverMask from '$lib/images/sundiverMask.svelte'
    import { translateFromCenter } from '$lib/utils/boardGeometry.js'

    import { type Point } from '@tabletop/common'
    import { attachAnimator } from '$lib/animators/stateAnimator.js'
    import type { CellSundiverAnimator } from '$lib/animators/cellSundiverAnimator.js'
    import type { SundiverAnimator } from '$lib/animators/sundiverAnimator.js'

    let {
        color,
        quantity = 1,
        width = 30,
        height = 40,
        fontSize = 23,
        location,
        animator,
        offBoard = false,
        alwaysShowQuantity = false,
        onclick
    }: {
        color: string
        width?: number
        height?: number
        fontSize?: number
        quantity?: number
        location?: Point
        animator?: CellSundiverAnimator | SundiverAnimator
        offBoard?: boolean
        alwaysShowQuantity?: boolean
        onclick?: () => void
    } = $props()

    let updateableQuantity = $derived(quantity)

    let onClick = () => {
        if (onclick) {
            onclick()
        }
    }

    function setQuantity(quantity: number) {
        updateableQuantity = quantity
    }

    if (animator) {
        animator.setQuantityCallback(setQuantity)
    }
</script>

<g
    {@attach animator && attachAnimator(animator)}
    on:click={onClick}
    transform={offBoard
        ? ''
        : translateFromCenter((location?.x ?? 0) - width / 2, (location?.y ?? 0) - height / 2)}
>
    <g transform="translate(-2, -2)">
        <SundiverMask
            width={width + 4}
            height={height + 4}
            fill={'black'}
            opacity=".5"
            overflow="visible"
            style="filter: url(#pieceshadow)"
        />
    </g>
    <SundiverIcon {width} {height} {color} />

    {#if updateableQuantity > 1 || alwaysShowQuantity}
        <text
            class="select-none pointer-events-none"
            style="filter: url(#textshadow); fill: black; letter-spacing:0"
            x={width / 2}
            y={height / 2}
            text-anchor="middle"
            dominant-baseline="middle"
            font-size={fontSize}
            font-weight="bold"
            stroke-width="1"
            stroke="#000000"
            opacity=".5"
            fill="black">{updateableQuantity}</text
        >
        <text
            x={width / 2}
            y={height / 2}
            class="select-none pointer-events-none"
            style="letter-spacing:0"
            text-anchor="middle"
            dominant-baseline="middle"
            font-size={fontSize}
            font-weight="bold"
            stroke-width="1"
            stroke="#FFFFFF"
            fill="white"
            >{updateableQuantity}
        </text>
    {/if}
</g>
