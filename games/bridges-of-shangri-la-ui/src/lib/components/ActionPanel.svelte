<script lang="ts">
    import { Button } from 'flowbite-svelte'
    import { getContext } from 'svelte'
    import {
        ActionType,
        HydratedPlaceMaster,
        HydratedRecruitStudents,
        MasterType,
        Placement
    } from '@tabletop/bridges-of-shangri-la'
    import type { BridgesGameSession } from '$lib/model/BridgesGameSession.svelte'

    let gameSession = getContext('gameSession') as BridgesGameSession
    let showCancel = $derived.by(() => {
        if (!gameSession.chosenAction) {
            return false
        }

        if (
            (gameSession.chosenAction === ActionType.PlaceMaster ||
                gameSession.chosenAction === ActionType.RecruitStudents) &&
            gameSession.validActionTypes.length === 1 &&
            (!gameSession.chosenMasterType || validMasterTypesToPlace.length === 1)
        ) {
            return false
        }

        if (
            gameSession.chosenAction === ActionType.BeginJourney &&
            gameSession.validActionTypes.length === 1
        ) {
            return false
        }

        return true
    })
    let showActions = $derived(!gameSession.chosenAction)
    let validMasterTypesToPlace = $derived.by(() => {
        if (
            !gameSession.myPlayer?.id ||
            (gameSession.chosenAction !== ActionType.PlaceMaster &&
                gameSession.chosenAction !== ActionType.RecruitStudents)
        ) {
            return []
        }
        const playerId = gameSession.myPlayer.id
        return Object.values(MasterType).filter((masterType) => {
            for (let index = 0; index < gameSession.gameState.board.villages.length; index++) {
                const placement: Placement = { village: index, masterType }
                if (gameSession.chosenAction === ActionType.PlaceMaster) {
                    const { valid, reason } = HydratedPlaceMaster.isValidPlacement(
                        gameSession.gameState,
                        playerId,
                        placement
                    )
                    if (valid) {
                        return true
                    }
                } else if (gameSession.chosenAction === ActionType.RecruitStudents) {
                    const { valid, reason } = HydratedRecruitStudents.isValidPlacement(
                        gameSession.gameState,
                        playerId,
                        placement
                    )
                    if (valid) {
                        return true
                    }
                }
            }
            return false
        })
    })

    async function chooseAction(action: string) {
        switch (action) {
            case ActionType.Pass:
                await gameSession.applyAction(gameSession.createPassAction())
                gameSession.resetAction()
                break
            default:
                gameSession.chosenAction = action
                break
        }
    }

    function chooseMaster(masterType: MasterType) {
        gameSession.chosenMasterType = masterType
    }

    const instructions = $derived.by(() => {
        if (!gameSession.chosenAction) {
            return 'Choose an action'
        }

        switch (gameSession.chosenAction) {
            case ActionType.PlaceMaster:
                if (gameSession.chosenMasterType) {
                    return 'Choose a village for the master'
                } else {
                    return 'Choose a master to place'
                }
            case ActionType.RecruitStudents:
                if (gameSession.chosenMasterType) {
                    return 'Choose a village for the student'
                } else {
                    return 'Choose a student to place'
                }
            case ActionType.BeginJourney:
                if (gameSession.chosenVillage === undefined) {
                    return 'Choose a village to begin their journey'
                } else {
                    return 'Choose a destination village'
                }
            default:
                return ''
        }
    })

    $effect(() => {
        if (gameSession.validActionTypes.length === 1) {
            const singleAction = gameSession.validActionTypes[0]
            chooseAction(singleAction).catch((error) => {
                console.error('Error choosing action:', error)
            })
        } else if (gameSession.validActionTypes.length === 0) {
            gameSession.resetAction()
        }
    })

    $effect(() => {
        if (gameSession.chosenAction === ActionType.PlaceMaster) {
            if (validMasterTypesToPlace.length === 1) {
                chooseMaster(validMasterTypesToPlace[0])
            }
        } else if (gameSession.chosenAction === ActionType.RecruitStudents) {
            if (validMasterTypesToPlace.length === 1) {
                chooseMaster(validMasterTypesToPlace[0])
            }
        }
    })
</script>

<div
    class="mb-2 rounded-lg bg-gray-300 p-2 text-center flex flex-row flex-wrap justify-center items-center"
>
    <div class="flex flex-col justify-center items-center mx-8">
        <h1 class="text-lg">{instructions}</h1>
        {#if gameSession.chosenAction === ActionType.PlaceMaster || gameSession.chosenAction === ActionType.RecruitStudents}
            {#if !gameSession.chosenMasterType}
                <div class="flex flex-row justify-start items-center space-x-2 mb-2">
                    {#each validMasterTypesToPlace as masterType}
                        {#if validMasterTypesToPlace.includes(masterType as MasterType)}
                            <div class="flex flex-col justify-center items-center">
                                <div class="mb-0 leading-3" style="font-size:.7rem; ">
                                    <button
                                        onclick={() => {
                                            chooseMaster(masterType as MasterType)
                                        }}
                                    >
                                        <img
                                            class="w-[50px]"
                                            src={gameSession.imageForMasterType(
                                                masterType as MasterType
                                            )}
                                            alt="master type"
                                        />
                                    </button>
                                </div>
                                {#if gameSession.myTurnCount >= 7}
                                    <div class="text-md leading-3">
                                        {gameSession.myPlayerState?.pieces[masterType]}
                                    </div>
                                {/if}
                            </div>
                        {/if}
                    {/each}
                </div>
            {:else}
                <div class="flex flex-row justify-start items-center space-x-2">
                    <div class="" style="font-size:.7rem; line-height:.8rem">
                        <img
                            class="w-[75px]"
                            src={gameSession.imageForMasterType(
                                gameSession.chosenMasterType as MasterType
                            )}
                            alt="master type"
                        />
                    </div>
                </div>
            {/if}
        {/if}
        <div class="flex flex-row justify-center items-center">
            {#if showCancel}
                <Button onclick={() => gameSession.cancel()} size="xs" class="m-1" color="red"
                    >Cancel</Button
                >
            {/if}
            {#if showActions}
                {#each gameSession.validActionTypes as action}
                    <Button
                        onclick={async () => chooseAction(action)}
                        size="xs"
                        class="m-1"
                        color="blue">{gameSession.nameForActionType(action)}</Button
                    >
                {/each}
            {/if}
        </div>
    </div>
</div>
