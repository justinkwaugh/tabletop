<script lang="ts">
    import { getContext } from 'svelte'
    import { Button } from 'flowbite-svelte'
    import { ActionType, HutType, MachineState } from '@tabletop/kaivai'
    import fishtoken from '$lib/images/fishtoken.png'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import DeliverySelection from './DeliverySelection.svelte'

    let gameSession = getContext('gameSession') as KaivaiGameSession
    let showCancel = $derived.by(() => {
        if (gameSession.chosenHutType || gameSession.chosenBoatLocation || gameSession.chosenBoat) {
            return true
        } else if (gameSession.chosenAction && gameSession.validActionTypes.length > 1) {
            return true
        }
        return false
    })
    let showActions = $derived(!gameSession.chosenAction)

    function chooseAction(action: string) {
        switch (action) {
            default:
                gameSession.chosenAction = action
                break
        }
    }

    const instructions = $derived.by(() => {
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
            case ActionType.MoveGod:
                if (!gameSession.gameState.godLocation) {
                    return 'Place the Fisherman God'
                } else {
                    return 'Move the Fisherman God'
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
</script>

<div
    class="mb-2 rounded-lg bg-transparent p-2 text-center flex flex-row flex-wrap justify-center items-center"
>
    <div class="flex flex-col justify-center items-center mx-8">
        <h1 class="text-lg">{instructions}</h1>
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
                            <div class="text-md">Meeting</div>
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
                            <div class="text-md">Boat</div>
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
                            <div class="text-md">Fishing</div>
                        {/if}
                    </button>
                {/if}
            </div>
        {/if}

        {#if gameSession.currentDeliveryLocation}
            <DeliverySelection />
        {/if}

        <div class="flex flex-row justify-center items-center">
            {#if showCancel}
                <Button onclick={() => gameSession.cancel()} size="xs" class="m-1" color="red"
                    >Cancel</Button
                >
            {/if}
            {#if gameSession.chosenAction === ActionType.Deliver && gameSession.chosenDeliveries.length > 0}
                <Button onclick={() => deliverFish()} size="xs" class="m-1" color="blue"
                    >Deliver the Fish</Button
                >
            {/if}
            {#if showActions}
                {#each gameSession.validActionTypes as action}
                    <Button onclick={() => chooseAction(action)} size="xs" class="m-1" color="blue"
                        >{action}</Button
                    >
                {/each}
            {/if}
        </div>
    </div>
</div>
