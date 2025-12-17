<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import boardImg from '$lib/images/board.jpg'
    import Cell from '$lib/components/Cell.svelte'
    import DropShadow from '$lib/components/DropShadow.svelte'
    import boardImg5p from '$lib/images/board5p.jpg'
    import Sandbox from './Sandbox.svelte'
    import Mothership from './Mothership.svelte'
    import { Direction, gateKey, Ring, SolarGate, type Sundiver } from '@tabletop/sol'
    import UISundiver from './Sundiver.svelte'
    import { SundiverAnimator } from '$lib/animators/sundiverAnimator.js'
    import {
        getGatePosition,
        offsetFromCenter,
        type GatePosition
    } from '$lib/utils/boardGeometry.js'
    import { coordinatesToNumber, sameCoordinates, type OffsetCoordinates } from '@tabletop/common'
    import GateDestination from './GateDestination.svelte'
    import Gate from './BoardGate.svelte'
    import InstabilityTrack from './InstabilityTrack.svelte'
    import Deck from './Deck.svelte'
    import Cube from '$lib/images/cube.svelte'
    import { animateCube, EnergyCubeAnimator } from '$lib/animators/energyCubeAnimator.js'
    import { animateGate, GateAnimator } from '$lib/animators/gateAnimator.js'
    import { SvelteMap } from 'svelte/reactivity'
    import CellOutline from './CellOutline.svelte'
    import ChainOverlay from './ChainOverlay.svelte'

    let gameSession = getContext('gameSession') as SolGameSession
    const boardImage = gameSession.numPlayers === 5 ? boardImg5p : boardImg

    // Non-reactive map of sundivers by ID for rendering sundiver movement
    const sundiversById: Map<string, Sundiver> = new Map()
    for (const diver of gameSession.gameState.getAllSundivers()) {
        sundiversById.set(diver.id, diver)
    }

    const gates = $derived.by(() => {
        const entries: [number, SolarGate][] = Object.entries(
            gameSession.gameState.board.gates
        ).map(([key, gate]) => [Number(key), gate])
        return new SvelteMap<number, SolarGate>(entries)
    })

    type GateData = {
        key: number
        position: GatePosition
        coords: OffsetCoordinates
        neighborCoords: OffsetCoordinates
    }

    const gatePositions: GateData[] = []
    for (const node of gameSession.gameState.board) {
        if (
            node.coords.row === Ring.Inner ||
            node.coords.row === Ring.Convective ||
            node.coords.row === Ring.Radiative
        ) {
            for (const neighbor of gameSession.gameState.board.neighborsAt(
                node.coords,
                Direction.In
            )) {
                gatePositions.push({
                    key: gameSession.gameState.board.gateKey(neighbor.coords, node.coords),
                    position: getGatePosition(gameSession.numPlayers, neighbor.coords, node.coords),
                    coords: node.coords,
                    neighborCoords: neighbor.coords
                })
            }
        }
    }

    const cubeAnimator = new EnergyCubeAnimator(gameSession)
    cubeAnimator.register()

    const gateAnimator = new GateAnimator(gameSession, (gate) => {
        if (gate) {
            gates.set(gateKey(gate.innerCoords!, gate.outerCoords!), gate)
        }
    })
    gateAnimator.register()

    const cellsToOutline = $derived.by(() => {
        return gameSession.outlinedCells
    })
</script>

<div class="relative w-[1280px] h-[1280px]">
    <div class="absolute top left w-[1280px] h-[1280px]">
        <img src={boardImage} alt="game board" />
    </div>
    <svg id="board" class="absolute z-0" width="1280" height="1280" viewBox="0 0 1280 1280">
        <defs>
            <DropShadow id="textshadow" />
            <DropShadow id="pieceshadow" offset={{ x: 0, y: 0 }} amount={20} />
        </defs>

        <InstabilityTrack width={760} height={35} location={{ x: (1280 - 760) / 2, y: 12 }} />
        <Deck width={100} height={142} location={{ x: 80, y: 10 }} />

        <!-- <Sandbox /> -->
        {#each [...sundiversById] as [, sundiver] (sundiver.id)}
            <UISundiver
                color={gameSession.colors.getPlayerColor(sundiver.playerId)}
                animator={new SundiverAnimator(gameSession, sundiver.id)}
            />
        {/each}
        {#each gameSession.movingCubeIds as cubeId (cubeId)}
            <g use:animateCube={{ animator: cubeAnimator, cubeId }}>
                <Cube width={30} height={30} />
            </g>
        {/each}

        {#each gameSession.gameState.board as cell}
            <Cell {cell} />
        {/each}

        {#each gatePositions as gate (gate.key)}
            <GateDestination {...gate} />
        {/each}

        {#each [...gates] as [key, gate] (key)}
            {#if gate.innerCoords && gate.outerCoords}
                <g class="pointer-events-none" use:animateGate={{ animator: gateAnimator, gate }}>
                    <Gate
                        color={gameSession.colors.getPlayerColor(gate.playerId)}
                        position={getGatePosition(
                            gameSession.numPlayers,
                            gate.innerCoords,
                            gate.outerCoords
                        )}
                    />
                </g>
            {/if}
        {/each}

        <ChainOverlay />

        {#each cellsToOutline as coords (coordinatesToNumber(coords))}
            <CellOutline {coords} />
        {/each}
        {#each gameSession.gameState.players as player (player.playerId)}
            <Mothership playerId={player.playerId} />
        {/each}

        <g
            id="board-picker-ref"
            style="transform:translate({offsetFromCenter(gameSession.boardPickerLocation)
                .x}px, {offsetFromCenter(gameSession.boardPickerLocation).y}px);"
        ></g>
    </svg>
</div>
