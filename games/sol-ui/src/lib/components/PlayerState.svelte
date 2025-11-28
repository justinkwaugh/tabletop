<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import { SolPlayerState, MachineState } from '@tabletop/sol'
    import { Color, range, type Player } from '@tabletop/common'
    import BlueBoard from '$lib/images/blueBoard.jpg'
    import GreenBoard from '$lib/images/greenBoard.jpg'
    import BlackBoard from '$lib/images/blackBoard.jpg'
    import SilverBoard from '$lib/images/silverBoard.jpg'
    import PurpleBoard from '$lib/images/purpleBoard.jpg'
    import GreenShip from '$lib/images/greenShip.svelte'
    import PurpleShip from '$lib/images/purpleShip.svelte'
    import SilverShip from '$lib/images/silverShip.svelte'
    import BlackShip from '$lib/images/blackShip.svelte'
    import BlueShip from '$lib/images/blueShip.svelte'

    let gameSession = getContext('gameSession') as SolGameSession
    let { player, playerState }: { player: Player; playerState: SolPlayerState } = $props()

    let isTurn = $derived(gameSession.game.state?.activePlayerIds.includes(playerState.playerId))
    let color = gameSession.colors.getPlayerColor(playerState.playerId)
    let bgColor = $derived(gameSession.colors.getPlayerBgColor(playerState.playerId))
    let textColor = $derived(gameSession.colors.getPlayerTextColor(playerState.playerId))

    let Ship = componentForColor(color)

    function componentForColor(color: Color) {
        switch (color) {
            case Color.Green:
                return GreenShip
            case Color.Purple:
                return PurpleShip
            case Color.Gray:
                return SilverShip
            case Color.Black:
                return BlackShip
            case Color.Blue:
                return BlueShip
            default:
                return GreenShip
        }
    }

    let backgroundImage = $derived.by(() => {
        switch (color) {
            case Color.Black:
                return `url(${BlackBoard})`
            case Color.Green:
                return `url(${GreenBoard})`
            case Color.Blue:
                return `url(${BlueBoard})`
            case Color.Purple:
                return `url(${PurpleBoard})`
            case Color.Gray:
                return `url(${SilverBoard})`
            default:
                return ''
        }
    })
</script>

<div class="relative">
    <div
        style="background-image: {backgroundImage}"
        class="bg-cover rounded-lg {bgColor} py-[3px] h-[185px] px-4 pb-2 text-center {gameSession.colors.getPlayerTextColor(
            playerState.playerId
        )} font-medium flex flex-col justify-between {isTurn ? 'border-2 pulse-border' : ''}"
    >
        <h1 class="{isTurn ? 'text-xl font-semibold' : 'text-lg font-medium'} mb-2">
            {isTurn ? '\u21e2 ' : ''}{player.name}{isTurn ? ' \u21e0' : ''}
        </h1>
        <div
            class="flex flex-row justify-between items-center rounded-lg dark:bg-black w-full h-full p-1"
        >
            <div class="flex flex-col justify-center items-center">
                <div class="flex flex-row space-x-2 justify-center items-center p-2">
                    {#each range(3, 6) as i}
                        <svg
                            class="pointer-events-none"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <circle
                                fill="#eeeeee"
                                stroke="#333333"
                                stroke-width=".5"
                                cx="12"
                                cy="12"
                                r="12"
                            ></circle>
                            <text
                                class="select-none"
                                style="fill: black"
                                x="11"
                                y="13"
                                text-anchor="middle"
                                dominant-baseline="middle"
                                font-size="14"
                                stroke-width="1"
                                stroke="#000000"
                                opacity="1"
                                fill="black">{i}</text
                            >
                        </svg>
                    {/each}
                </div>
                <div class="flex flex-row justify-between items-center w-full px-2">
                    <svg
                        class="pointer-events-none"
                        width="50"
                        height="100"
                        viewBox="0 0 250 450"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <g transform="">
                            <Ship />
                        </g>
                    </svg>
                    <div class="flex flex-col justify-center items-center h-full py-2">
                        <div>Energy: {playerState.energyCubes}</div>
                        <div>Divers: {playerState.holdSundivers.length}</div>
                    </div>
                </div>
            </div>
            <div class="rounded-lg dark:bg-gray-700 w-[85px] h-full"></div>
        </div>
        {#if gameSession.showDebug}
            <div class="text-xs mt-2">id: {player.id}</div>
        {/if}
    </div>
</div>

<style>
    @keyframes border-pulsate {
        0% {
            border-color: rgba(255, 255, 255, 0);
        }
        25% {
            border-color: rgba(255, 255, 255, 255);
        }
        75% {
            border-color: rgba(255, 255, 255, 255);
        }
        100% {
            border-color: rgba(255, 255, 255, 0);
        }
    }

    .pulse-border {
        border-color: white;
        animation: border-pulsate 2.5s infinite;
    }
</style>
