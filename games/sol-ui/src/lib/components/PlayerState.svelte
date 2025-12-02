<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import { SolPlayerState } from '@tabletop/sol'
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
    import Card from './Card.svelte'
    import CardBack from '$lib/images/cardBack.png'
    import Cube from '$lib/images/cube.svelte'
    import Sundiver from '$lib/images/sundiver.svelte'
    import Gate from '$lib/images/gate.svelte'
    import Tower from '$lib/images/tower.svelte'
    import Foundry from '$lib/images/foundry.svelte'
    import EnergyNode from '$lib/images/energynode.svelte'

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

    let cardBackImage = `url(${CardBack})`
</script>

<div class="relative">
    <div
        class="bg-cover rounded-lg {bgColor} pt-[3px] px-1 pb-1 text-center {gameSession.colors.getPlayerTextColor(
            playerState.playerId
        )} font-medium flex flex-col justify-between {isTurn ? 'border-2 pulse-border' : ''}"
    >
        <h1 class="{isTurn ? 'text-xl font-semibold' : 'text-lg font-medium'} mb-1">
            {isTurn ? '\u21e2 ' : ''}{player.name}{isTurn ? ' \u21e0' : ''}
        </h1>
        <div
            class="flex flex-row justify-between items-center rounded-lg dark:bg-black/70 w-full h-full p-1"
        >
            <div class="flex flex-col justify-between items-center w-full">
                <div class="flex flex-row space-x-2 justify-center items-center pt-1 pb-2">
                    {#each range(3, 6) as i}
                        <svg
                            class="pointer-events-none"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <circle
                                fill="#dddddd"
                                stroke="#333333"
                                stroke-width=".5"
                                cx="12"
                                cy="12"
                                r="12"
                            ></circle>
                            <text
                                class="select-none"
                                style="fill: black"
                                x="12"
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
                <div class="flex flex-row justify-between items-center w-full px-3">
                    <div class="shrink-0">
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
                    </div>
                    <div
                        class="flex flex-col justify-between items-center h-full w-fit text-[.75rem] sol-font-bold text-[#cccccc] leading-none tracking-widest"
                    >
                        <div class="flex flex-row justify-start items-end gap-x-2 w-full mb-[-5px]">
                            <div class="flex flex-col justify-center items-center gap-y-1">
                                <Sundiver width={28 * 0.75} height={28} color={playerState.color} />

                                <div>{gameSession.myPlayerState?.holdSundivers.length ?? 0}</div>
                            </div>
                            <div class="flex flex-col justify-center items-center gap-y-1">
                                <Cube width={26} height={26} />
                                <div>{gameSession.myPlayerState?.energyCubes ?? 0}</div>
                            </div>
                        </div>
                        <div
                            class="flex flex-row justify-start items-end gap-x-2 w-full text-[.75rem] sol-font-bold text-[#cccccc] leading-none"
                        >
                            <div class="flex flex-col justify-center items-center gap-y-1">
                                <Gate width={25} height={21} color={playerState.color} />
                                <div>{gameSession.myPlayerState?.solarGates.length ?? 0}</div>
                            </div>
                            <div class="flex flex-col justify-center items-center gap-y-1">
                                <EnergyNode width={23} height={25} color={playerState.color} />
                                <div>{gameSession.myPlayerState?.energyNodes.length ?? 0}</div>
                            </div>
                            <div class="flex flex-col justify-center items-center gap-y-1">
                                <Foundry width={23} height={25} color={playerState.color} />
                                <div>
                                    {gameSession.myPlayerState?.sundiverFoundries.length ?? 0}
                                </div>
                            </div>

                            <div class="flex flex-col justify-center items-center gap-y-1">
                                <Tower width={19} height={40} color={playerState.color} />
                                <div>{gameSession.myPlayerState?.transmitTowers.length ?? 0}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="rounded-lg dark:bg-gray-700 w-[94px] h-[136px] overflow-hidden shrink-0">
                {#if playerState.card}
                    <Card suit={playerState.card.suit} />
                {:else}
                    <div
                        style="background-image: {cardBackImage}"
                        class="bg-center bg-cover w-full h-full"
                    ></div>
                {/if}
            </div>
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
