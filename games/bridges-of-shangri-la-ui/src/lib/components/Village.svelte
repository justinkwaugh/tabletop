<script lang="ts">
    import healer from '$lib/images/healer.png'
    import rainmaker from '$lib/images/rainmaker.png'
    import dragonbreeder from '$lib/images/dragonbreeder.png'
    import firekeeper from '$lib/images/firekeeper.png'
    import priest from '$lib/images/priest.png'
    import yetiwhisperer from '$lib/images/yetiwhisperer.png'
    import astrologer from '$lib/images/astrologer.png'
    import stone from '$lib/images/stone.png'
    import {
        MasterType,
        type HydratedVillage,
        HydratedPlaceMaster,
        Placement,
        ActionType,
        HydratedRecruitStudents,
        HydratedBeginJourney
    } from '@tabletop/bridges-of-shangri-la'
    import { getContext } from 'svelte'
    import type { BridgesGameSession } from '$lib/model/BridgesGameSession.svelte'

    let { village, index }: { village: HydratedVillage; index: number } = $props()
    let gameSession = getContext('gameSession') as BridgesGameSession

    let interacting = $derived.by(() => {
        if (
            gameSession.chosenAction === ActionType.PlaceMaster ||
            gameSession.chosenAction === ActionType.RecruitStudents
        ) {
            return gameSession.chosenMasterType !== undefined
        } else if (gameSession.chosenAction === ActionType.BeginJourney) {
            return true
        }
        return false
    })

    let interactable = $derived.by(() => {
        if (!gameSession.isMyTurn || !gameSession.myPlayer?.id) {
            return false
        }
        if (gameSession.chosenAction === ActionType.PlaceMaster && gameSession.chosenMasterType) {
            const placement: Placement = {
                village: index,
                masterType: gameSession.chosenMasterType
            }
            const { valid, reason } = HydratedPlaceMaster.isValidPlacement(
                gameSession.gameState,
                gameSession.myPlayer?.id,
                placement
            )
            if (!valid) {
                console.log('Invalid placement at village', index, reason)
            }
            return valid
        } else if (
            gameSession.chosenAction === ActionType.RecruitStudents &&
            gameSession.chosenMasterType
        ) {
            const placement: Placement = {
                village: index,
                masterType: gameSession.chosenMasterType
            }
            const { valid, reason } = HydratedRecruitStudents.isValidPlacement(
                gameSession.gameState,
                gameSession.myPlayer?.id,
                placement
            )
            if (!valid) {
                console.log('Invalid placement at village', index, reason)
            }
            return valid
        } else if (gameSession.chosenAction === ActionType.BeginJourney) {
            if (gameSession.chosenVillage === undefined) {
                const { valid, reason } = HydratedBeginJourney.isValidSourceVillage(
                    gameSession.gameState,
                    gameSession.myPlayer?.id,
                    index
                )
                return valid
            } else {
                const { valid, reason } = HydratedBeginJourney.isValidDestinationVillage(
                    gameSession.gameState,
                    index,
                    gameSession.chosenVillage
                )
                return valid
            }
        }
        return false
    })

    let disabled = $derived(
        village.stone ||
            (interacting && !interactable) ||
            (gameSession.highlightedVillages.length > 0 &&
                !gameSession.highlightedVillages.includes(index))
    )
    let isSourceVillageForJourney = $derived(
        interacting &&
            gameSession.chosenAction === ActionType.BeginJourney &&
            gameSession.chosenVillage === index
    )

    let tabIndex = $derived(interactable ? 0 : -1)
    function bgColorForMaster(masterType: MasterType) {
        return gameSession.getPlayerBgColor(village.spaces[masterType]?.playerId)
    }

    function imageForMaster(masterType: MasterType) {
        switch (masterType) {
            case MasterType.Healer:
                return healer
            case MasterType.Rainmaker:
                return rainmaker
            case MasterType.DragonBreeder:
                return dragonbreeder
            case MasterType.Firekeeper:
                return firekeeper
            case MasterType.Priest:
                return priest
            case MasterType.YetiWhisperer:
                return yetiwhisperer
            case MasterType.Astrologer:
                return astrologer
        }
    }

    async function handleClick() {
        if (!interactable) {
            return
        }

        if (gameSession.chosenAction === ActionType.PlaceMaster && gameSession.chosenMasterType) {
            const action = gameSession.createPlaceMasterAction(index, gameSession.chosenMasterType)
            gameSession.applyAction(action)
            gameSession.resetAction()
        } else if (
            gameSession.chosenAction === ActionType.RecruitStudents &&
            gameSession.chosenMasterType
        ) {
            const action = gameSession.createRecruitStudentsAction(
                index,
                gameSession.chosenMasterType
            )
            gameSession.applyAction(action)
            gameSession.resetAction()
        } else if (gameSession.chosenAction === ActionType.BeginJourney) {
            if (gameSession.chosenVillage === undefined) {
                gameSession.chosenVillage = index
            } else {
                const action = gameSession.createBeginJourneyAction(
                    gameSession.chosenVillage,
                    index
                )
                gameSession.applyAction(action)
                gameSession.resetAction()
            }
        }
    }
</script>

{#snippet space(masterType: MasterType, offsets: string)}
    {#if village.hasMaster(masterType)}
        <div
            class="pointer-events-none absolute w-[49px] h-[50px] {offsets} {bgColorForMaster(
                masterType
            )}
    )} border-2 border-gray-800 z-10"
        >
            <img src={imageForMaster(masterType)} alt="rain maker" />
        </div>
        {#if village.hasStudent(masterType)}
            <div
                class="absolute w-[49px] h-[50px] {offsets} bg-opacity-40 bg-gray-900 text-white flex flex-col justify-center items-center z-20"
            >
                <h1 class="text-2xl">S</h1>
            </div>
        {/if}
    {/if}
{/snippet}

<div
    role="button"
    tabindex={tabIndex}
    onfocus={() => {}}
    onclick={() => handleClick()}
    onkeypress={() => handleClick()}
    class="relative w-[150px] h-[150px] {interactable ? 'cursor-pointer' : ''}"
>
    <div
        class="flex flex-col justify-center items-center border-2 border-gray-400 rounded-full w-[60px] h-[46px] py-2 px-4 bg-gray-800 absolute top-[2px] left-[-40px] text-gray-200"
    >
        <h1 class="text-3xl select-none">{village.strength()}</h1>
    </div>
    {@render space(MasterType.Rainmaker, 'top-0 left-[27px]')}
    {@render space(MasterType.Astrologer, 'top-0 left-[78px]')}
    {@render space(MasterType.DragonBreeder, 'top-[52px] left-0')}
    {@render space(MasterType.Priest, 'top-[52px] left-[51px]')}
    {@render space(MasterType.YetiWhisperer, 'top-[52px] left-[102px]')}
    {@render space(MasterType.Firekeeper, 'top-[105px] left-[25px]')}
    {@render space(MasterType.Healer, 'top-[105px] left-[76px]')}

    {#if village.stone}
        <div
            class="flex flex-col justify-center items-center w-[150px] h-[150px] absolute top-[-55px] left-[-90px] z-50"
        >
            <img class="w-[75px] drop-shadow-xl" src={stone} alt="stone" />
        </div>
    {/if}

    {#if disabled && !isSourceVillageForJourney}
        <div
            class="absolute rounded-full w-[200px] h-[200px] top-[-25px] left-[-25px] bg-black bg-opacity-50 z-40 shadow-[0_0_40px_0] shadow-black"
        ></div>
    {/if}

    {#if isSourceVillageForJourney}
        <div
            class="absolute rounded-full w-[150px] h-[150px] top-0 left-0 bg-green-500 bg-opacity-60 z-0 shadow-[0_0_40px_0] shadow-green-500"
        ></div>
    {/if}
</div>
