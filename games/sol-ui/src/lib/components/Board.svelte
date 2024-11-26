<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import boardImg from '$lib/images/board.jpg'
    import Cell from '$lib/components/Cell.svelte'
    import DropShadow from '$lib/components/DropShadow.svelte'
    import Mothership from './Mothership.svelte'
    import SundiverIcon from '$lib/images/sundiver.svelte'
    import Tower from '$lib/images/tower.svelte'
    import boardImg5p from '$lib/images/board5p.jpg'
    import { SolGraph } from '@tabletop/sol'
    import { translateFromCenter } from '$lib/utils/boardGeometry.js'
    import Sundiver from './Sundiver.svelte'

    let gameSession = getContext('gameSession') as SolGameSession
    const graph = new SolGraph(gameSession.numPlayers)
</script>

<div class="relative w-[1280px] h-[1280px]">
    <div class="absolute top left w-[1280px] h-[1280px]">
        <img src={boardImg} alt="game board" />
    </div>
    <svg class="absolute z-10" width="1280" height="1280" viewBox="0 0 1280 1280">
        <defs>
            <DropShadow id="textshadow" />
            <DropShadow id="divershadow" offset={{ x: 0, y: 0 }} amount={20} />
        </defs>

        {#each graph as node}
            <Cell coords={node.coords} />
        {/each}

        {#each gameSession.gameState.players as player}
            <Mothership playerId={player.playerId} />
        {/each}

        <Sundiver
            playerId={gameSession.gameState.players[0].playerId}
            quantity={1}
            location={{ x: -70, y: 0 }}
        />

        <g transform="{translateFromCenter(70, 0)} scale(.8) translate(-19, -25)">
            <SundiverIcon class="gray" />
        </g>
        <g transform={translateFromCenter(70, 0)}>
            <text
                class="select-none"
                style="filter: url(#textshadow); fill: black"
                y="1"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="20"
                font-weight="bold"
                stroke-width="1"
                stroke="#000000"
                opacity=".5"
                fill="black">4</text
            >
            <text
                y="1"
                class="select-none"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="20"
                font-weight="bold"
                stroke-width="1"
                stroke="#FFFFFF"
                fill="white"
                >4
            </text>
        </g>
        <g transform="{translateFromCenter(100, 0)} scale(.8) translate(-19, -25)">
            <SundiverIcon />
        </g>
        <g transform={translateFromCenter(100, 0)}>
            <text
                class="select-none"
                style="filter: url(#textshadow); fill: black"
                y="1"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="20"
                font-weight="bold"
                stroke-width="1"
                stroke="#000000"
                opacity=".5"
                fill="black">2</text
            >
            <text
                y="1"
                class="select-none"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="20"
                font-weight="bold"
                stroke-width="1"
                stroke="#FFFFFF"
                fill="white"
                >2
            </text>
        </g>

        <g transform="{translateFromCenter(130, 0)} scale(.8) translate(-19, -25)">
            <SundiverIcon class="green" />
        </g>
        <g transform={translateFromCenter(130, 0)}>
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
                fill="black">3</text
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
                >3
            </text>
        </g>

        <g transform="{translateFromCenter(80, -40)} scale(.8) translate(-19, -25)">
            <SundiverIcon class="blue" />
        </g>
        <g transform={translateFromCenter(80, -40)}>
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
                fill="black">4</text
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
                >4
            </text>
        </g>

        <g transform="{translateFromCenter(110, -40)} scale(.8) translate(-19, -25)">
            <SundiverIcon class="purple" />
        </g>
        <g transform={translateFromCenter(110, -40)}>
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
                fill="black">5</text
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
                >5
            </text>
        </g>
        <g transform="{translateFromCenter(70, 70)} scale(.9) translate(-24, -50)">
            <Tower />
        </g>
    </svg>
</div>
