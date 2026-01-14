<script lang="ts">
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import boardImg from '$lib/images/board.jpg'
    import Cell from '$lib/components/Cell.svelte'
    import DropShadow from '$lib/components/DropShadow.svelte'
    import boardImg5p from '$lib/images/board5p.jpg'
    import Sandbox from './Sandbox.svelte'
    import Mothership from './Mothership.svelte'
    import { Direction, gateKey, Ring, SolarGate } from '@tabletop/sol'
    import UISundiver from './Sundiver.svelte'
    import { SundiverAnimator } from '$lib/animators/sundiverAnimator.js'
    import {
        getGatePosition,
        offsetFromCenter,
        type GatePosition
    } from '$lib/utils/boardGeometry.js'
    import { coordinatesToNumber, type OffsetCoordinates } from '@tabletop/common'
    import GateDestination from './GateDestination.svelte'
    import Gate from './BoardGate.svelte'
    import InstabilityTrack from './InstabilityTrack.svelte'
    import Deck from './Deck.svelte'
    import Cube from '$lib/images/cube.svelte'
    import { animateCube, EnergyCubeAnimator } from '$lib/animators/energyCubeAnimator.js'
    import Pentagon from '$lib/images/pentagon.svelte'
    import { animateMomentum, MomentumAnimator } from '$lib/animators/momentumAnimator.js'
    import { animateGate, GateAnimator } from '$lib/animators/gateAnimator.js'
    import { SvelteMap } from 'svelte/reactivity'
    import CellOutline from './CellOutline.svelte'
    import ChainOverlay from './ChainOverlay.svelte'
    import { animateStation, StationAnimator } from '$lib/animators/stationAnimator.js'
    import Station from './Station.svelte'
    import { ConvertType } from '$lib/definition/convertType.js'
    import ActiveEffects from './ActiveEffects.svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let gameSession = getGameSession() as SolGameSession
    const boardImage = gameSession.numPlayers === 5 ? boardImg5p : boardImg

    const gates = $derived.by(() => {
        let entries: [number, SolarGate][] = Object.entries(gameSession.gameState.board.gates).map(
            ([key, gate]) => [Number(key), gate]
        )

        entries = entries.filter(([key, gate]) => showGate(key))
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

    const momentumAnimator = new MomentumAnimator(gameSession)
    momentumAnimator.register()

    const stationAnimator = new StationAnimator(gameSession)
    stationAnimator.register()

    const gateAnimator = new GateAnimator(gameSession, (gate) => {
        if (gate) {
            gates.set(gateKey(gate.innerCoords!, gate.outerCoords!), gate)
        }
    })
    gateAnimator.register()

    const sundiverAnimator = new SundiverAnimator(gameSession)
    sundiverAnimator.register()

    const cellsToOutline = $derived.by(() => {
        return gameSession.outlinedCells
    })

    function showGate(key: number) {
        if (gameSession.updatingVisibleState || !gameSession.myPlayer) return true

        if (!gameSession.isConverting && !gameSession.isMoving) {
            return true
        }

        if (gameSession.isConverting && gameSession.chosenConvertType === ConvertType.SolarGate) {
            return !gameSession.validGateDestinations.includes(key)
        }

        if (gameSession.isMoving) {
            return !gameSession.gateChoices?.includes(key)
        }

        return true
    }
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

        {#if gameSession.movingStation}
            <g
                use:animateStation={{
                    animator: stationAnimator
                }}
            >
                {#if gameSession.movingStation}
                    <Station
                        color={gameSession.colors.getPlayerColor(
                            gameSession.movingStation.playerId
                        )}
                        station={gameSession.movingStation}
                    />
                {/if}
            </g>
        {/if}

        {#each gameSession.movingCubeIds as cubeId (cubeId)}
            <g use:animateCube={{ animator: cubeAnimator, cubeId }}>
                <g transform="translate(-17.5, -17.5)">
                    <Cube width={35} height={35} />
                </g>
            </g>
        {/each}
        {#each gameSession.movingMomentumIds as momentumId (momentumId)}
            <g use:animateMomentum={{ animator: momentumAnimator, momentumId }}>
                <g transform="translate(-26.25, -26.25)">
                    <Pentagon width={52.5} height={52.5} />
                </g>
            </g>
        {/each}

        {#each gameSession.gameState.board as cell (coordinatesToNumber(cell.coords))}
            <Cell {cell} />
        {/each}

        {#each gameSession.movingSundivers as sundiver (sundiver.id)}
            <g class="pointer-events-none">
                <UISundiver
                    color={gameSession.colors.getPlayerColor(sundiver.playerId)}
                    {sundiverAnimator}
                    sundiverId={sundiver.id}
                />
            </g>
        {/each}

        {#each gatePositions as gate (gate.key)}
            <GateDestination {...gate} />
        {/each}

        <ChainOverlay />

        {#each cellsToOutline as coords (coordinatesToNumber(coords))}
            <CellOutline {coords} />
        {/each}
        {#each gameSession.gameState.players as player (player.playerId)}
            <Mothership playerId={player.playerId} />
        {/each}

        <Deck width={100} height={142} location={{ x: 80, y: 10 }} />
        <ActiveEffects width={135} height={100} location={{ x: 1100, y: 16 }} />
        <g
            id="board-picker-ref"
            style="transform:translate({offsetFromCenter(gameSession.boardPickerLocation)
                .x}px, {offsetFromCenter(gameSession.boardPickerLocation).y}px);"
            ><rect width="1" height="1" fill="transparent"></rect></g
        >
    </svg>

    <!-- <Sandbox /> -->
</div>
