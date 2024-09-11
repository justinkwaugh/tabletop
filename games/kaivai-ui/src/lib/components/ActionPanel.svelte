<script lang="ts">
    import { getContext } from 'svelte'
    import { ActionType, HutType, MachineState, Ruleset } from '@tabletop/kaivai'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import DeliverySelection from './DeliverySelection.svelte'
    import PlayerName from './PlayerName.svelte'

    let gameSession = getContext('gameSession') as KaivaiGameSession
    let bidValue = $state(0)
    let showCancel = $derived.by(() => {
        if (isMultiBoatState() && !gameSession.chosenBoat) {
            return false
        }

        if (gameSession.chosenHutType || gameSession.chosenBoatLocation || gameSession.chosenBoat) {
            return true
        } else if (gameSession.chosenAction && gameSession.validActionTypes.length > 1) {
            return true
        }
        return false
    })

    let buttonRow = $derived.by(() => {
        return (
            showCancel ||
            (gameSession.chosenAction === ActionType.Deliver &&
                gameSession.chosenDeliveries.length > 0)
        )
    })

    function isMultiBoatState() {
        return (
            gameSession.gameState.machineState === MachineState.Building ||
            gameSession.gameState.machineState === MachineState.Delivering ||
            gameSession.gameState.machineState === MachineState.Fishing ||
            gameSession.gameState.machineState === MachineState.Moving
        )
    }

    async function chooseAction(action: string) {
        switch (action) {
            case ActionType.Increase:
                await increase()
                break
            default:
                gameSession.chosenAction = action
                break
        }
    }

    async function increase() {
        const action = gameSession.createIncreaseAction()
        gameSession.applyAction(action)
        gameSession.resetAction()
    }

    const instructions = $derived.by(() => {
        if (!gameSession.chosenBoat) {
            if (gameSession.gameState.machineState === MachineState.Building) {
                return 'Build again with another boat?'
            } else if (gameSession.gameState.machineState === MachineState.Delivering) {
                return 'Deliver again with another boat?'
            } else if (gameSession.gameState.machineState === MachineState.Fishing) {
                return 'Fish again with another boat?'
            } else if (gameSession.gameState.machineState === MachineState.Moving) {
                return 'Move another boat?'
            }
        }

        if (!gameSession.chosenAction) {
            return 'Choose an action'
        }

        switch (gameSession.chosenAction) {
            case ActionType.PlaceBid:
                return 'Place your bid'
            case ActionType.Build:
                if (
                    gameSession.gameState.machineState === MachineState.TakingActions ||
                    gameSession.gameState.machineState === MachineState.Building
                ) {
                    if (!gameSession.chosenBoat) {
                        return 'Choose a boat to use'
                    } else if (!gameSession.chosenBoatLocation) {
                        return 'Choose a destination for your boat'
                    }
                }

                if (!gameSession.chosenHutType) {
                    return 'Choose a hut type'
                } else {
                    switch (gameSession.chosenHutType) {
                        case HutType.Meeting:
                            return 'Place your meeting hut'
                        case HutType.BoatBuilding:
                            return 'Place your boat building hut'
                        case HutType.Fishing:
                            return 'Place your fishing hut'
                    }
                }
            case ActionType.Fish:
                if (!gameSession.chosenBoat) {
                    return 'Choose a boat to use'
                } else {
                    return 'Choose a destination for your boat'
                }
            case ActionType.Deliver:
                if (!gameSession.chosenBoat) {
                    return 'Choose a boat to use'
                } else if (!gameSession.chosenBoatLocation) {
                    return 'Choose a destination for your boat'
                } else if (gameSession.currentDeliveryLocation) {
                    return 'How many fish will you deliver here?'
                } else if (gameSession.chosenDeliveries.length > 0) {
                    return 'Add or change deliveries or deliver the fish!'
                } else if (gameSession.validDeliveryLocationIds.length > 0) {
                    return 'Choose any delivery location'
                }
            case ActionType.Move:
                if (!gameSession.chosenBoat) {
                    return 'Choose a boat to move'
                } else {
                    return 'Choose a destination for your boat'
                }
            case ActionType.Celebrate:
                return 'Choose an island for your celebration'
            case ActionType.MoveGod:
                if (!gameSession.gameState.godLocation) {
                    return 'Place the Fisherman God'
                } else {
                    return 'Move the Fisherman God'
                }
            case ActionType.ChooseScoringIsland: {
                return 'Choose an island to score'
            }
            case ActionType.PlaceScoringBid: {
                const verb =
                    gameSession.game.config.ruleset === Ruleset.FirstEdition ? 'bid' : 'spend'
                return `How much influence do you want to ${verb}?`
            }
            default:
                return ''
        }
    })

    $effect(() => {
        if (gameSession.validActionTypes.length === 1) {
            const singleAction = gameSession.validActionTypes[0]
            chooseAction(singleAction)
        } else if (gameSession.validActionTypes.length === 0) {
            gameSession.resetAction()
        } else if (
            gameSession.gameState.machineState === MachineState.Building &&
            gameSession.validActionTypes.includes(ActionType.Build)
        ) {
            chooseAction(ActionType.Build)
        } else if (
            gameSession.gameState.machineState === MachineState.Moving &&
            gameSession.validActionTypes.includes(ActionType.Move)
        ) {
            chooseAction(ActionType.Move)
        } else if (
            gameSession.gameState.machineState === MachineState.Delivering &&
            gameSession.validActionTypes.includes(ActionType.Deliver)
        ) {
            chooseAction(ActionType.Deliver)
        } else if (
            gameSession.gameState.machineState === MachineState.Fishing &&
            gameSession.validActionTypes.includes(ActionType.Fish)
        ) {
            chooseAction(ActionType.Fish)
        }
    })

    function chooseHutType(hutType: HutType) {
        gameSession.chosenHutType = hutType
    }

    function canChooseHutType(hutType: HutType) {
        if (gameSession.chosenHutType) {
            return false
        }
        switch (hutType) {
            case HutType.Meeting:
                return true
            case HutType.BoatBuilding:
                return gameSession.myPlayerState?.hasBoats()
            case HutType.Fishing:
                return gameSession.myPlayerState?.hasFisherman()
        }
    }

    function deliverFish() {
        if (
            !gameSession.chosenBoat ||
            !gameSession.chosenBoatLocation ||
            gameSession.chosenDeliveries.length === 0
        ) {
            return
        }

        const action = gameSession.createDeliverAction({
            boatId: $state.snapshot(gameSession.chosenBoat),
            boatCoords: $state.snapshot(gameSession.chosenBoatLocation),
            deliveries: $state.snapshot(gameSession.chosenDeliveries)
        })
        gameSession.applyAction(action)
        gameSession.resetAction()
    }

    function incrementBid() {
        bidValue = Math.min(bidValue + 1, gameSession.myPlayerState?.influence ?? 0)
    }

    function decrementBid() {
        bidValue = Math.max(bidValue - 1, 0)
    }

    function getIslandInfluence(playerId: string) {
        let influence = gameSession.gameState.board.playerInfluenceOnIsland(
            playerId,
            gameSession.gameState.chosenIsland ?? '?'
        )
        if (playerId === gameSession.myPlayer?.id) {
            influence += bidValue
        }
        return influence
    }

    async function placeScoringBid() {
        const action = gameSession.createPlaceScoringBidAction(bidValue)
        gameSession.applyAction(action)
        gameSession.resetAction()
    }
</script>

<div
    class="rounded-lg bg-transparent p-2 text-center flex flex-row flex-wrap justify-center items-center"
>
    <div class="flex flex-col justify-center items-center mx-8">
        <h1 class="text-xl uppercase text-[#372b0a] kaivai-font">
            {instructions}
        </h1>
        {#if gameSession.chosenAction === ActionType.PlaceScoringBid}
            <div class="mt-2 flex flex-row justify-center items-center gap-8">
                <div
                    class="p-2 flex flex-col justify-center items-center rounded-lg border-2 border-[#634a11]"
                >
                    <h1 class="text-lg kaivai-font uppercase">Majority</h1>
                    <div class="flex flex-col justify-center items-start">
                        {#each gameSession.gameState.players as player}
                            <div class="flex flex-row justify-between items-center w-full">
                                <div class="mr-8">
                                    <PlayerName playerId={player.playerId} />
                                </div>
                                <div>
                                    {getIslandInfluence(player.playerId)}
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
                <div class="flex flex-col justify-center items-center">
                    <div class="flex flex-row justify-center items-center mt-2 mb-3 text-white">
                        <button
                            class="flex flex-col justify-center items-center rounded-full w-[35px] h-[35px] bg-[#634a11]"
                            onclick={decrementBid}><h1 class="text-2xl">-</h1></button
                        >
                        <h1 class="w-[50px] text-4xl text-[#372b0a]">{bidValue}</h1>
                        <button
                            class="flex flex-col justify-center items-center rounded-full w-[35px] h-[35px] bg-[#634a11]"
                            onclick={incrementBid}><h1 class="text-2xl">+</h1></button
                        >
                    </div>
                    <button
                        onclick={() => placeScoringBid()}
                        class="px-2 uppercase bg-[#634a11] rounded-lg text-white kaivai-font"
                        >Submit</button
                    >
                </div>
            </div>
        {/if}
        {#if gameSession.chosenAction === ActionType.Build && ((gameSession.chosenBoat && gameSession.chosenBoatLocation) || gameSession.gameState.machineState === MachineState.InitialHuts)}
            <div class="flex flex-row justify-center items-center space-x-2">
                {#if canChooseHutType(HutType.Meeting) || gameSession.chosenHutType === HutType.Meeting}
                    <button
                        onclick={() => chooseHutType(HutType.Meeting)}
                        class="flex flex-col justify-center items-center"
                    >
                        <img
                            src={gameSession.getHutImage(HutType.Meeting, gameSession.myPlayer?.id)}
                            alt="meeting"
                            class="w-16 h-16"
                        />
                        {#if !gameSession.chosenHutType}
                            <div class="text-md uppercase kaivai-font">Meeting</div>
                        {/if}
                    </button>
                {/if}
                {#if canChooseHutType(HutType.BoatBuilding) || gameSession.chosenHutType === HutType.BoatBuilding}
                    <button
                        onclick={() => chooseHutType(HutType.BoatBuilding)}
                        class="flex flex-col justify-center items-center"
                    >
                        <img
                            src={gameSession.getHutImage(
                                HutType.BoatBuilding,
                                gameSession.myPlayer?.id
                            )}
                            alt="boatbuilder"
                            class="w-16 h-16"
                        />
                        {#if !gameSession.chosenHutType}
                            <div class="text-md uppercase kaivai-font">Boat</div>
                        {/if}
                    </button>
                {/if}
                {#if canChooseHutType(HutType.Fishing) || gameSession.chosenHutType === HutType.Fishing}
                    <button
                        onclick={() => chooseHutType(HutType.Fishing)}
                        class="flex flex-col justify-center items-center"
                    >
                        <img
                            src={gameSession.getHutImage(HutType.Fishing, gameSession.myPlayer?.id)}
                            alt="fishing"
                            class="w-16 h-16"
                        />
                        {#if !gameSession.chosenHutType}
                            <div class="text-md uppercase kaivai-font">Fishing</div>
                        {/if}
                    </button>
                {/if}
            </div>
        {/if}

        {#if gameSession.currentDeliveryLocation}
            <DeliverySelection />
        {/if}

        {#if buttonRow}
            <div class="flex flex-row justify-center items-center mt-2 space-x-2">
                {#if showCancel}
                    <button
                        onclick={() => gameSession.cancel()}
                        class="px-2 uppercase bg-[#634a11] rounded-lg text-white kaivai-font"
                        >{'\u21bc'} Back</button
                    >
                {/if}
                {#if gameSession.chosenAction === ActionType.Deliver && gameSession.chosenDeliveries.length > 0}
                    <button
                        onclick={() => deliverFish()}
                        class="px-2 uppercase bg-[#634a11] rounded-lg text-white kaivai-font"
                        >Deliver the fish! {'\u21c0'}</button
                    >
                {/if}
            </div>
        {/if}
    </div>
</div>
