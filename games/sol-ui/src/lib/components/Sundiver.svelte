<script lang="ts">
    import SundiverIcon from '$lib/images/sundiver.svelte'
    import SundiverMask from '$lib/images/sundiverMask.svelte'
    import { translateFromCenter } from '$lib/utils/boardGeometry.js'

    import { type Point } from '@tabletop/common'
    import { attachAnimator, StateAnimator } from '$lib/animators/stateAnimator.js'

    let {
        id,
        color,
        quantity = 1,
        location,
        animator,
        onclick
    }: {
        id?: string
        playerId?: string
        color: string
        quantity?: number
        location?: Point
        animator?: StateAnimator<any, any, any>
        onclick?: () => void
    } = $props()

    let onClick = () => {
        if (onclick) {
            onclick()
        }
    }
</script>

<g
    {@attach animator && attachAnimator(animator)}
    on:click={onClick}
    transform={translateFromCenter(location?.x ?? 0, location?.y ?? 0)}
>
    <g transform="scale(.8) translate(-19, -25)">
        <g transform="translate(-1, -1)">
            <SundiverMask
                width="40"
                height="52"
                fill={'black'}
                opacity=".5"
                overflow="visible"
                style="filter: url(#divershadow)"
            />
        </g>
        <SundiverIcon class={color} />
    </g>
    {#if quantity > 1}
        <g transform="translate(0,0)">
            <text
                class="select-none pointer-events-none"
                style="filter: url(#textshadow); fill: black;"
                y="1"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="23"
                font-weight="bold"
                stroke-width="1"
                stroke="#000000"
                opacity=".5"
                fill="black">{quantity}</text
            >
            <text
                y="1"
                class="select-none pointer-events-none"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="23"
                font-weight="bold"
                stroke-width="1"
                stroke="#FFFFFF"
                fill="white"
                >{quantity}
            </text>
        </g>
    {/if}
</g>
