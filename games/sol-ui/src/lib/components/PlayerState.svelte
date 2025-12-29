<script lang="ts">
    import { getContext, onMount } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import { ActionType, HydratedSolPlayerState } from '@tabletop/sol'
    import { Color, range, type Player } from '@tabletop/common'
    import GreenShip from '$lib/images/greenShip.svelte'
    import PurpleShip from '$lib/images/purpleShip.svelte'
    import SilverShip from '$lib/images/silverShip.svelte'
    import BlackShip from '$lib/images/blackShip.svelte'
    import BlueShip from '$lib/images/blueShip.svelte'
    import type { Card as SolCard, Suit } from '@tabletop/sol'
    import Card from './Card.svelte'
    import CardBack from '$lib/images/cardBack.png'
    import Cube from '$lib/images/cube.svelte'
    import Sundiver from '$lib/images/sundiver.svelte'
    import Gate from '$lib/images/gate.svelte'
    import Tower from '$lib/images/tower.svelte'
    import Foundry from '$lib/images/foundry.svelte'
    import EnergyNode from '$lib/images/energynode.svelte'
    import Sun from '$lib/images/sun.png'
    import { Popover } from 'flowbite-svelte'
    import EffectCard from './EffectCard.svelte'

    let gameSession = getContext('gameSession') as SolGameSession
    let { player, playerState }: { player: Player; playerState: HydratedSolPlayerState } = $props()
    let animateReady = false
    let playerStateOverride = $derived.by(() =>
        gameSession.playerStateOverrides.get(playerState.playerId)
    )

    onMount(() => {
        animateReady = true
    })

    let isTurn = $derived(gameSession.gameState.activePlayerIds.includes(playerState.playerId))
    let color = $derived(gameSession.colors.getPlayerColor(playerState.playerId))
    let bgColor = $derived(gameSession.colors.getPlayerBgColor(playerState.playerId))

    let Ship = $derived(componentForColor(color))

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

    let card = $derived.by(() => {
        if (playerState.card) {
            return playerState.card
        }

        const currentTurnPlayer = gameSession.gameState.turnManager.currentTurn()?.playerId
        if (currentTurnPlayer === playerState.playerId && gameSession.gameState.activeEffect) {
            const activeSuit = Object.entries(gameSession.gameState.effects).find(
                ([, effect]) => effect.type === gameSession.gameState.activeEffect
            )?.[0]
            if (activeSuit) {
                return { id: 'active-effect-card', suit: activeSuit as Suit } satisfies SolCard
            }
        }

        return
    })

    let cardBackImage = `url(${CardBack})`

    let canActivate = $derived.by(() => {
        if (!gameSession.isMyTurn || gameSession.myPlayer?.id !== playerState.playerId) {
            return false
        }

        return gameSession.validActionTypes.includes(ActionType.ActivateEffect)
    })

    let isActiveCard = $derived.by(() => {
        if (!card) {
            return false
        }
        const currentTurnPlayer = gameSession.gameState.turnManager.currentTurn()?.playerId
        if (currentTurnPlayer !== playerState.playerId) {
            return false
        }
        return (
            gameSession.gameState.activeEffect !== null &&
            gameSession.gameState.effects[card.suit].type === gameSession.gameState.activeEffect
        )
    })

    let energyCubes = $derived(playerStateOverride?.energyCubes ?? playerState.energyCubes)
    let reserveSundiversCount = $derived(
        playerStateOverride?.reserveSundivers ?? playerState.reserveSundivers.length
    )
    let solarGatesCount = $derived(playerStateOverride?.solarGates ?? playerState.solarGates.length)
    let energyNodesCount = $derived(
        playerStateOverride?.energyNodes ?? playerState.energyNodes.length
    )
    let sundiverFoundriesCount = $derived(
        playerStateOverride?.sundiverFoundries ?? playerState.sundiverFoundries.length
    )
    let transmitTowersCount = $derived(
        playerStateOverride?.transmitTowers ?? playerState.transmitTowers.length
    )

    let holdDiversByPlayer = $derived.by(() => {
        const holdSundivers = playerStateOverride?.holdSundiversByPlayer
            ? Array.from(playerStateOverride.holdSundiversByPlayer.entries())
            : Array.from(playerState.holdSundiversPerPlayer().entries()).map(
                  ([playerId, sundivers]) => [playerId, sundivers.length] as const
              )
        // Player's own sundivers first
        return holdSundivers
            .filter(([, count]) => count > 0)
            .sort(([a], [b]) => {
                const aVal = `${a === playerState.playerId ? 'a' : 'b'}:${a}`
                const bVal = `${b === playerState.playerId ? 'a' : 'b'}:${b}`
                return aVal.localeCompare(bVal)
            })
    })

    function popOnChange(node: HTMLElement, value: number | string) {
        let lastValue = value

        const trigger = () => {
            node.classList.remove('pop-bounce')
            void node.offsetWidth
            node.classList.add('pop-bounce')
        }

        if (animateReady) {
            trigger()
        }

        return {
            update(nextValue: number | string) {
                if (nextValue === lastValue) {
                    return
                }
                lastValue = nextValue
                if (!animateReady) {
                    return
                }
                trigger()
            }
        }
    }
</script>

<div class="relative">
    <div
        class="sol-font-bold uppercase bg-cover rounded-lg {bgColor} pt-[3px] px-1 pb-1 text-center {gameSession.colors.getPlayerTextColor(
            playerState.playerId
        )} font-medium flex flex-col justify-between border-2 {isTurn
            ? 'border-white pulse-border'
            : gameSession.colors.getPlayerBorderColor(playerState.playerId)}"
    >
        <h1 class="ms-2 text-left tracking-widest text-lg">
            {isTurn ? '\u21e2 ' : ''}{player.name}
        </h1>
        <div
            class="flex flex-row justify-between items-center rounded-lg dark:bg-black/70 w-full h-full p-1"
        >
            <div class="flex flex-col justify-between items-center w-full h-[136px]">
                <div class="flex flex-row space-x-1 justify-center items-center pb-2 pt-1">
                    {#each range(3, 6) as i (i)}
                        <div
                            style={playerState.movement === i
                                ? `background-image: url(${Sun})`
                                : ''}
                            class="flex justify-center items-center w-[24px] h-[24px] bg-center bg-cover"
                        >
                            <svg
                                class="pointer-events-none"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <circle
                                    fill={playerState.movement === i ? 'none' : '#dddddd'}
                                    stroke="none"
                                    cx="12"
                                    cy="12"
                                    r="12"
                                ></circle>
                                <text
                                    class="select-none tracking-tight"
                                    x="12"
                                    y="13"
                                    text-anchor="middle"
                                    dominant-baseline="middle"
                                    font-size="14"
                                    stroke-width="1"
                                    stroke={playerState.movement === i ? '#ffffff' : '#000000'}
                                    opacity="1"
                                    fill={playerState.movement === i ? '#ffffff' : '#000000'}
                                    >{i}</text
                                >
                            </svg>
                        </div>
                    {/each}
                </div>
                <div class="flex flex-row justify-between items-center w-full h-full px-3 pb-1">
                    <div class="flex flex-col justify-between items-center h-full">
                        <div class="text-[.5rem] tracking-normal sol-font text-[#cccccc]">HOLD</div>
                        <div class="shrink-0">
                            <Ship
                                width={35}
                                height={60}
                                transform={color === Color.Blue || color === Color.Green
                                    ? 'rotate(180)'
                                    : undefined}
                            />
                        </div>
                        <div class="text-[.5rem] tracking-normal sol-font text-[#cccccc]">
                            RESERVE
                        </div>
                    </div>
                    <div
                        class="flex flex-col justify-between items-center h-full w-fit text-[.75rem] sol-font-bold text-[#cccccc] leading-none tracking-widest"
                    >
                        <div
                            class="flex flex-row justify-start items-start gap-x-2 w-full mb-[-5px]"
                        >
                            {#if holdDiversByPlayer.length === 0}
                                <div
                                    class="flex flex-col justify-center items-center gap-y-1"
                                    use:popOnChange={0}
                                >
                                    <div class="tracking-normal">0</div>
                                    <Sundiver
                                        width={25 * 0.75}
                                        height={25}
                                        color={gameSession.colors.getPlayerColor(
                                            playerState.playerId
                                        )}
                                    />
                                </div>
                            {:else}
                                {#each holdDiversByPlayer as [playerId, count] (playerId)}
                                    <div
                                        class="flex flex-col justify-center items-center gap-y-1"
                                        use:popOnChange={count}
                                    >
                                        <div class="tracking-normal">{count}</div>
                                        <Sundiver
                                            width={25 * 0.75}
                                            height={25}
                                            color={gameSession.colors.getPlayerColor(playerId)}
                                        />
                                    </div>
                                {/each}
                            {/if}
                            <div
                                class="flex flex-col justify-center items-center gap-y-1"
                                use:popOnChange={energyCubes}
                            >
                                <div class="tracking-normal">{energyCubes}</div>
                                <Cube
                                    id="{playerState.playerId}-energy-supply"
                                    width={24}
                                    height={24}
                                />
                            </div>
                        </div>
                        <div
                            class="flex flex-row justify-start items-end gap-x-2 w-full text-[.75rem] sol-font-bold text-[#cccccc] leading-none"
                        >
                            <div
                                class="flex flex-col justify-center items-center gap-y-1"
                                use:popOnChange={reserveSundiversCount}
                            >
                                <Sundiver
                                    width={25 * 0.75}
                                    height={25}
                                    color={playerState.color}
                                    opacity={reserveSundiversCount > 0 ? 1 : 0.3}
                                />
                                <div class="tracking-normal">
                                    {reserveSundiversCount}
                                </div>
                            </div>
                            <div
                                class="flex flex-col justify-center items-center gap-y-1"
                                use:popOnChange={solarGatesCount}
                            >
                                <Gate
                                    width={25}
                                    height={21}
                                    color={playerState.color}
                                    opacity={solarGatesCount > 0 ? 1 : 0.3}
                                />
                                <div class="tracking-normal">{solarGatesCount}</div>
                            </div>
                            <div
                                class="flex flex-col justify-center items-center gap-y-1"
                                use:popOnChange={energyNodesCount}
                            >
                                <EnergyNode
                                    width={23}
                                    height={25}
                                    color={playerState.color}
                                    opacity={energyNodesCount > 0 ? 1 : 0.3}
                                />
                                <div class="tracking-normal">{energyNodesCount}</div>
                            </div>
                            <div
                                class="flex flex-col justify-center items-center gap-y-1"
                                use:popOnChange={sundiverFoundriesCount}
                            >
                                <Foundry
                                    width={23}
                                    height={25}
                                    color={playerState.color}
                                    opacity={sundiverFoundriesCount > 0 ? 1 : 0.3}
                                />
                                <div class="tracking-normal">
                                    {sundiverFoundriesCount}
                                </div>
                            </div>

                            <div
                                class="flex flex-col justify-center items-center gap-y-1"
                                use:popOnChange={transmitTowersCount}
                            >
                                <Tower
                                    width={19}
                                    height={40}
                                    color={playerState.color}
                                    opacity={transmitTowersCount > 0 ? 1 : 0.3}
                                />
                                <div class="tracking-normal">
                                    {transmitTowersCount}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="rounded-lg w-[94px] h-[136px] overflow-hidden shrink-0 grid card-grid">
                <div
                    style="background-image: {cardBackImage}"
                    class="bg-center bg-cover w-full h-full opacity-30"
                ></div>
                {#if card}
                    <div class="w-full h-full z-10">
                        <Card showActivate={canActivate} showActive={isActiveCard} {card} />

                        <Popover
                            classes={{ content: 'p-0 rounded-md overflow-hidden dark:border-0' }}
                            placement="right"
                            triggeredBy={`[id='${card.id}']`}
                            trigger="hover"
                            arrow={false}
                            offset={15}
                            ><EffectCard
                                effectType={gameSession.gameState.effects[card.suit].type}
                                effectSuit={card.suit}
                            /></Popover
                        >
                    </div>
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

    .card-grid > * {
        grid-area: 1 / 1;
    }

    .pop-bounce {
        animation: pop-bounce 320ms ease-out;
        transform-origin: center;
    }

    @keyframes pop-bounce {
        0% {
            transform: scale(1);
        }
        35% {
            transform: scale(1.35);
        }
        60% {
            transform: scale(0.93);
        }
        80% {
            transform: scale(1.06);
        }
        100% {
            transform: scale(1);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .pop-bounce {
            animation: none;
        }
    }
</style>
