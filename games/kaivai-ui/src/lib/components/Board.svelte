<script lang="ts">
    import { getContext } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import { defineHex, Grid, spiral, Orientation } from 'honeycomb-grid'
    import board from '$lib/images/board.png'
    import Cell from './Cell.svelte'
    import buildImg from '$lib/images/build.png'
    import moveImg from '$lib/images/move.png'
    import increaseImg from '$lib/images/increase.png'
    import celebrateImg from '$lib/images/celebrate.png'
    import fishImg from '$lib/images/fish.png'
    import deliverImg from '$lib/images/deliver.png'
    import passImg from '$lib/images/pass.png'
    import skipImg from '$lib/images/skip.png'
    import influenceImg from '$lib/images/influence.png'
    import sacrificeImg from '$lib/images/sacrifice.png'

    import { ActionType, MachineState } from '@tabletop/kaivai'
    import { fade } from 'svelte/transition'

    let gameSession = getContext('gameSession') as KaivaiGameSession

    const Hex = defineHex({
        dimensions: { width: 100, height: 87 },
        orientation: Orientation.FLAT
    })

    const spiralTraverser = spiral({ radius: 6, start: [0, 0] })
    const grid = new Grid(Hex, spiralTraverser)
    const yOffset = grid.pixelHeight / 2
    const xOffset = grid.pixelWidth / 2

    let origin = { x: xOffset, y: yOffset + 100 }

    function getImageForAction(actionType: ActionType) {
        switch (actionType) {
            case ActionType.Move:
                return moveImg
            case ActionType.Build:
                return buildImg
            case ActionType.Increase:
                return increaseImg
            case ActionType.Deliver:
                return deliverImg
            case ActionType.Celebrate:
                return celebrateImg
            case ActionType.Fish:
                return fishImg
            case ActionType.Pass:
                if (
                    gameSession.gameState.machineState === MachineState.Fishing ||
                    gameSession.gameState.machineState === MachineState.Building ||
                    gameSession.gameState.machineState === MachineState.Moving ||
                    gameSession.gameState.machineState === MachineState.Delivering
                ) {
                    return skipImg
                } else {
                    return passImg
                }
            case ActionType.Sacrifice:
                return sacrificeImg
            default:
                return ''
        }
    }

    let canSacrifice: boolean = $derived(
        gameSession.validActionTypes.includes(ActionType.Sacrifice) && !gameSession.chosenAction
    )

    async function chooseAction(action: ActionType) {
        if (
            gameSession.isMyTurn &&
            gameSession.validActionTypes.includes(action) &&
            (!gameSession.chosenAction || action === ActionType.Pass)
        ) {
            if (action === ActionType.Increase) {
                await increase()
            } else if (action === ActionType.Pass) {
                await pass()
            } else if (action === ActionType.Sacrifice) {
                await sacrifice()
            } else {
                gameSession.chosenAction = action
            }
        }
    }

    async function increase() {
        const action = gameSession.createIncreaseAction()
        gameSession.applyAction(action)
        gameSession.resetAction()
    }

    async function pass() {
        const action = gameSession.createPassAction()
        gameSession.applyAction(action)
        gameSession.resetAction()
    }

    async function sacrifice() {
        const action = gameSession.createSacrificeAction()
        gameSession.applyAction(action)
        gameSession.resetAction()
    }

    function isEnabled(action: ActionType) {
        if (!gameSession.isMyTurn) {
            return true
        }

        if (
            (gameSession.gameState.machineState === MachineState.Fishing ||
                gameSession.gameState.machineState === MachineState.Building ||
                gameSession.gameState.machineState === MachineState.Moving ||
                gameSession.gameState.machineState === MachineState.Delivering) &&
            action === ActionType.Pass
        ) {
            return true
        }

        return (
            gameSession.validActionTypes.includes(action) &&
            (!gameSession.chosenAction || gameSession.chosenAction === action)
        )
    }
</script>

{#snippet actionDisk(actionType: ActionType, x: number, y: number, radius: number = 75)}
    <g pointer-events="visible">
        <image
            href={getImageForAction(actionType)}
            {x}
            {y}
            width={radius * 2}
            height={radius * 2}
            opacity={isEnabled(actionType) ? '1' : '.4'}
        >
        </image>
        <circle
            onclick={() => chooseAction(actionType)}
            cx={x + radius}
            cy={y + radius}
            r={radius}
            fill="none"
            stroke="#634a11"
            stroke-width="4"
        ></circle>
        {#if gameSession.gameState.influence[actionType] > 0}
            <g
                transform="translate ({x}, {y})"
                in:fade={{ duration: 200 }}
                out:fade={{ duration: 200 }}
                class="pointer-events-none"
            >
                <image
                    transform="translate ({radius - 25}, {radius + 15})"
                    href={influenceImg}
                    width={50}
                    height={50}
                >
                </image>
                <text
                    class="kaivai-font select-none"
                    x={radius}
                    y={radius + 43}
                    text-anchor="middle"
                    dominant-baseline="middle"
                    font-size="40"
                    font-weight="bold"
                    stroke-width="1"
                    stroke="#FFFFFF"
                    fill="white"
                    >{gameSession.gameState.influence[actionType]}
                </text>
            </g>
        {/if}
        {#if !isEnabled(actionType)}
            <circle
                in:fade={{ duration: 150 }}
                out:fade={{ duration: 150 }}
                cx={x + radius}
                cy={y + radius}
                r={radius}
                fill="black"
                opacity="0.3"
                stroke="black"
                stroke-width="4"
            ></circle>
        {/if}
    </g>
{/snippet}

<div class="flex flex-col justify-center items-center p-2">
    <div class="relative w-[1016px] h-[1247px]">
        <div class="absolute top-[100px] left-0 w-full z-0">
            <img class="w-[1200px]" src={board} alt="board" />
        </div>
        <div
            class="absolute z-10"
            style="width:{grid.pixelWidth + 16 + 'px'};height:{grid.pixelHeight + 16 + 100 + 'px'};"
        >
            <svg width={Math.ceil(grid.pixelWidth + 16)} height={Math.ceil(grid.pixelHeight) + 100}>
                <defs>
                    <filter id="dropshadow" height="130%">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="10 10"></feGaussianBlur>
                        <feOffset dx="50" dy="-20" result="offsetblur"></feOffset>
                        <feComponentTransfer>
                            <feFuncA type="linear" slope="0.5"></feFuncA>
                        </feComponentTransfer>
                        <feMerge>
                            <feMergeNode></feMergeNode>
                            <feMergeNode in="SourceGraphic"></feMergeNode>
                        </feMerge>
                    </filter>
                    <filter id="textshadow" width="130%" height="130%">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="1 1" result="shadow"
                        ></feGaussianBlur>
                        <feOffset dx="3" dy="9"></feOffset>
                    </filter>
                </defs>
                <g transform="translate(8,1) scale(1,.980)">
                    {@render actionDisk(ActionType.Move, 5, 150)}
                    {@render actionDisk(ActionType.Build, 85, 5)}
                    {@render actionDisk(ActionType.Increase, 250, 5)}
                    {@render actionDisk(ActionType.Deliver, 845, 150)}
                    {@render actionDisk(ActionType.Fish, 765, 5)}
                    {@render actionDisk(ActionType.Celebrate, 600, 5)}
                    {#if gameSession.isMyTurn}
                        {#if canSacrifice}
                            {@render actionDisk(ActionType.Sacrifice, 460, 5, 40)}
                        {:else}
                            {@render actionDisk(ActionType.Pass, 460, 5, 40)}
                        {/if}
                    {/if}

                    {#each grid as hex}
                        <Cell {hex} {origin} />
                    {/each}
                </g>
            </svg>
        </div>
    </div>
</div>
