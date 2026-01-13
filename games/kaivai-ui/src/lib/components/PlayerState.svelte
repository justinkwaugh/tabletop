<script lang="ts">
    import { range, type Player } from '@tabletop/common'
    import { HydratedKaivaiPlayerState, MachineState } from '@tabletop/kaivai'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let gameSession = getGameSession() as KaivaiGameSession
    let { player, playerState }: { player: Player; playerState: HydratedKaivaiPlayerState } =
        $props()

    let isTurn = $derived(gameSession.game.state?.activePlayerIds.includes(player.id))
    let bgColor = $derived(gameSession.colors.getPlayerBgColor(player.id))

    let movementBonusList = ['+1', '+2', '+2', '+3', '+3', '+4', '+4', '+5']

    let isPassed = $derived(gameSession.gameState.passedPlayers.includes(player.id))
</script>

<div class="relative">
    <div
        class="rounded-lg {bgColor} py-[3px] px-4 text-center {gameSession.colors.getPlayerTextColor(
            playerState.playerId
        )} {isPassed ? 'opacity-40' : ''} font-medium flex flex-col justify-between {isTurn
            ? 'border-2 pulse-border'
            : ''}"
    >
        <div class="flex flex-row justify-between items-center">
            <h1
                class="text-ellipsis overflow-hidden text-nowrap {isTurn
                    ? 'text-xl font-semibold'
                    : 'text-lg font-medium'}"
            >
                {isTurn ? '\u276f' : ''}
                {player.name}
            </h1>

            <div class="flex flex-row justify-center items-center kaivai-font space-x-2">
                <div class="flex flex-col justify-center items-center">
                    <div class="uppercase" style="font-size:.7rem; line-height:.8rem">move</div>
                    <div class="text-xl">
                        {gameSession.gameState.machineState === MachineState.Bidding &&
                        gameSession.gameState.bids[playerState.playerId] === undefined
                            ? '-'
                            : playerState.movement()}
                    </div>
                </div>
                <div class="flex flex-col justify-center items-center">
                    <div class="uppercase" style="font-size:.7rem; line-height:.8rem">build</div>
                    <div class="text-xl">
                        {gameSession.gameState.machineState === MachineState.Bidding &&
                        gameSession.gameState.bids[playerState.playerId] === undefined
                            ? '-'
                            : playerState.buildingCost}
                    </div>
                </div>
                <div class="flex flex-col justify-center items-center">
                    <div class="uppercase" style="font-size:.7rem; line-height:.8rem">infl.</div>
                    <div class="text-xl">{playerState.influence}</div>
                </div>
                <div class="flex flex-col justify-center items-center">
                    <div class="uppercase" style="font-size:.7rem; line-height:.8rem">glory</div>
                    <div class="text-xl">{playerState.score}</div>
                </div>
            </div>
        </div>
        <div class="flex flex-row justify-center items-center mb-2 rounded-lg bg-gray-100">
            <div>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18px"
                    height="18px"
                    viewBox="0 0 512 512"
                    fill="black"
                    stroke="black"
                    stroke-width="15"
                >
                    <path
                        d="M333.5,31.6c0-6.2-4.7-24.2-24.8-19.9C114.5,53.5,81.8,257.9,76.3,323.4h257.3V31.6z"
                    ></path>
                    <path
                        d="M19.7,364.3L94.6,491c3.7,6.2,10.4,10,17.6,10h287.7c7.2,0,13.9-3.8,17.6-10l74.9-126.7H19.7z"
                    ></path>
                </svg>
            </div>
            {#each movementBonusList as bonus, i}
                <div
                    class="w-[32px] h-[24px] kaivai-font text-xs text-black flex justify-center items-center"
                >
                    <div
                        class="p-1 rounded-full {playerState.movementModiferPosition - 1 === i
                            ? 'border-black border-2'
                            : ''}"
                    >
                        {bonus}
                    </div>
                </div>
            {/each}
        </div>

        <div class="flex flex-row justify-center items-center mb-1">
            <div class="flex flex-col justify-center items-center">
                <div
                    class="w-[40px] h-[12px] kaivai-font"
                    style="font-size:.7rem; line-height:.8rem"
                ></div>
                <div
                    class="text-lg w-[40px] h-[25px] flex justify-center items-center border-e-2 {gameSession.colors.getPlayerBorderContrastColor(
                        playerState.playerId
                    )}"
                >
                    <svg
                        width="18px"
                        height="18px"
                        viewBox="0 0 32 32"
                        stroke={gameSession.getPlayerSvgColor(playerState.playerId)}
                        fill={gameSession.getPlayerSvgColor(playerState.playerId)}
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M16 1.151c-8.88 0-16 7.182-16 16.156 0 1.328 0.052 1.833 0.328 3.104l4.88 3.615 0.76 6.021h8.135l0.438 0.302c0.5 0.349 0.938 0.5 1.443 0.5 0.469 0 0.974-0.135 1.365-0.417l0.521-0.385h8.125l0.75-6.021 4.927-3.615c0.276-1.271 0.328-1.776 0.328-3.104 0-8.969-7.12-16.156-16-16.156zM17.328 4.161c1.198 0 2.37 0.297 3.349 0.865l-3.286 16.729 4.563-16.078c1.411 0.479 2.479 1.25 3.344 2.417l0.031 0.047-6.536 14.151 7.427-12.948 0.047 0.036c1.010 0.943 1.661 2.089 1.99 3.531l-8.26 10.224 8.583-8.667 0.010 0.026c0.339 0.75 0.557 1.813 0.557 2.661 0 0.677-0.031 0.948-0.219 1.667l-4.74 3.469-0.62 4.948h-5.969l-0.688 0.526c-0.266 0.208-0.646 0.354-0.911 0.354s-0.646-0.146-0.911-0.354l-0.688-0.526h-5.974l-0.589-4.813-4.839-3.557c-0.146-0.578-0.214-1.104-0.214-1.677 0-0.964 0.214-1.99 0.568-2.74l0.016-0.031 8.604 8.734-8.307-10.328c0.333-1.417 1.167-2.786 2.188-3.62l7.391 13.036-6.604-14.109c0.74-1.089 1.932-1.943 3.391-2.438l4.568 16.094-3.458-16.703 0.073-0.042c1.083-0.599 2.13-0.875 3.276-0.875 0.26 0 0.38 0.005 0.703 0.042l0.781 17.401 0.615-17.417c0.297-0.031 0.411-0.036 0.74-0.036z"
                        ></path>
                    </svg>
                </div>
                <div
                    class="text-lg w-[40px] h-[25px] flex justify-center items-center border-e-2 {gameSession.colors.getPlayerBorderContrastColor(
                        playerState.playerId
                    )}"
                >
                    <svg
                        height="20px"
                        width="20px"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 512 512"
                        stroke={gameSession.getPlayerSvgColor(playerState.playerId)}
                        fill={gameSession.getPlayerSvgColor(playerState.playerId)}
                    >
                        <path
                            class="st0"
                            d="M508.727,159.883c-14.908-8.942-74.31,45.732-91.456,68.595c-57.163-34.302-108.602-57.164-108.602-57.164
                s22.862-100.025-8.578-94.318c-28.638,5.212-81.664,42.558-125.749,77.172C100.033,174.176,10.164,225.086,0,274.201
                c28.577,94.318,191.489,140.042,288.66,160.05c47.831,9.852,20.009-57.155,20.009-57.155s51.439-22.87,108.602-57.163
                c17.147,22.862,76.548,77.536,91.456,68.594c14.293-8.577-22.862-114.326-22.862-114.326S523.02,168.461,508.727,159.883z"
                        ></path>
                    </svg>
                </div>
            </div>

            {#each range(0, 5) as i}
                <div class="flex flex-col justify-center items-center">
                    <div
                        class="w-[40px] h-[12px] kaivai-font"
                        style="font-size:.7rem; line-height:.8rem"
                    >
                        {i + 1}
                    </div>
                    <div
                        class="text-lg w-[40px] h-[25px] kaivai-font border-e-2 {gameSession.colors.getPlayerBorderContrastColor(
                            playerState.playerId
                        )}"
                    >
                        {playerState.shells[i] ? playerState.shells[i] : ''}
                    </div>
                    <div
                        class="text-lg w-[40px] h-[25px] kaivai-font border-e-2 {gameSession.colors.getPlayerBorderContrastColor(
                            playerState.playerId
                        )}"
                    >
                        {playerState.fish[i] ? playerState.fish[i] : ''}
                    </div>
                </div>
            {/each}
            <div class="flex flex-col justify-center items-center">
                <div
                    class="w-[50px] h-[12px] kaivai-font uppercase"
                    style="font-size:.7rem; line-height:.8rem"
                >
                    value
                </div>
                <div class="text-lg w-[50px] h-[25px] kaivai-font">
                    {playerState.money()}
                </div>
                <div class="text-lg w-[50px] h-[25px] kaivai-font">
                    {playerState.numFish()}
                </div>
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
