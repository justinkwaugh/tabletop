<script lang="ts">
    import SundiverIcon from '$lib/images/sundiver.svelte'
    import SundiverMask from '$lib/images/sundiverMask.svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
    import { translateFromCenter } from '$lib/utils/boardGeometry.js'
    import { Color, type Point } from '@tabletop/common'
    import { getContext } from 'svelte'

    let { playerId, quantity, location }: { playerId: string; quantity: number; location: Point } =
        $props()

    let gameSession = getContext('gameSession') as SolGameSession
    let playerColor = gameSession.gameState.getPlayerState(playerId).color

    function cssColor(color: Color) {
        switch (color) {
            case Color.Black:
                return 'black'
            case Color.Blue:
                return 'blue'
            case Color.Green:
                return 'green'
            case Color.Purple:
                return 'purple'
            case Color.Gray:
                return 'gray'
            default:
                return 'black'
        }
    }
</script>

<g transform="{translateFromCenter(location.x, location.y)} scale(.8) translate(-19, -25)">
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
    <SundiverIcon class={cssColor(playerColor)} />
</g>
{#if quantity > 1}
    <g transform={translateFromCenter(location.x, location.y)}>
        <text
            class="select-none"
            style="filter: url(#textshadow); fill: black"
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
            class="select-none"
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
