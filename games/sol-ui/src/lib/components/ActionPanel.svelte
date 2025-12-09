<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import MoveArrows from '$lib/images/movearrows.svelte'
    import ConvertAtom from '$lib/images/convertatom.svelte'
    import ActivateBolt from '$lib/images/activatebolt.svelte'
    import { ActionCategory } from '$lib/definition/actionCategory.js'
    import LaunchPicker from './LaunchPicker.svelte'
    import Header from './Header.svelte'
    import { ActionType } from '@tabletop/sol'
    import ConvertPicker from './ConvertPicker.svelte'
    import CardPicker from './CardPicker.svelte'
    import { fade } from 'svelte/transition'
    import { CardPickerAnimator } from '$lib/animators/cardPickerAnimator.js'

    type CallToAction = {
        message?: string
        showSkip: boolean
        yesNo: boolean
    }

    let gameSession = getContext('gameSession') as SolGameSession

    async function chooseAction(action: string) {
        switch (action) {
            default:
                gameSession.chosenAction = action
                break
        }
    }

    let moveChosen = $derived(gameSession.chosenActionCategory === ActionCategory.Move)
    let convertChosen = $derived(gameSession.chosenActionCategory === ActionCategory.Convert)
    let activateChosen = $derived(gameSession.chosenActionCategory === ActionCategory.Activate)

    const canMove = $derived(
        (gameSession.validActionTypes.includes(ActionType.Launch) ||
            gameSession.validActionTypes.includes(ActionType.Fly) ||
            gameSession.validActionTypes.includes(ActionType.Hurl)) &&
            !convertChosen &&
            !activateChosen
    )
    const canConvert = $derived(
        gameSession.validActionTypes.includes(ActionType.Convert) && !moveChosen && !activateChosen
    )
    const canActivate = $derived(
        gameSession.validActionTypes.includes(ActionType.Activate) && !moveChosen && !convertChosen
    )

    const callToAction = $derived.by(() => {
        const result = { message: undefined, showSkip: false, yesNo: false } as CallToAction

        if (gameSession.forcedCallToAction) {
            result.message = gameSession.forcedCallToAction
            return result
        }

        if (moveChosen || gameSession.isMoving) {
            if (!gameSession.chosenMothership && !gameSession.chosenSource) {
                result.message = 'CHOOSE A MOVEMENT SOURCE'
                result.showSkip = true
            }
            if (gameSession.chosenSource && !gameSession.chosenNumDivers) {
                result.message = 'HOW MANY TO MOVE?'
            }
            if (gameSession.chosenMothership && !gameSession.chosenNumDivers) {
                result.message = 'HOW MANY TO LAUNCH?'
            }
            if (gameSession.gateChoices && gameSession.gateChoices.length > 0) {
                result.message = 'CHOOSE A GATE TO USE'
            } else if (gameSession.chosenNumDivers) {
                result.message = `CHOOSE A DESTINATION FOR ${gameSession.chosenNumDivers} SUNDIVER${
                    gameSession.chosenNumDivers > 1 ? 'S' : ''
                }`
            }
        } else if (convertChosen) {
            if (!gameSession.chosenConvertType) {
                result.message = 'WHAT WILL YOU CONVERT?'
            } else if (gameSession.diverCellChoices) {
                result.message = 'CHOOSE A SUNDIVER'
            } else if (!gameSession.chosenDestination) {
                result.message = 'CHOOSE A LOCATION'
            }
        } else if (activateChosen) {
            result.message = 'CHOOSE A STATION'
        } else if (gameSession.isActivating) {
            if (
                gameSession.gameState.activation &&
                !gameSession.gameState.activation.currentStationId
            ) {
                result.message = 'ACTIVATE ANOTHER?'
                result.showSkip = true
            } else {
                result.message = 'CLAIM THE BONUS?'
                result.yesNo = true
            }
        } else if (gameSession.isDrawingCards) {
            result.message = `DRAW ${gameSession.gameState.cardsToDraw ?? 0} CARD${
                (gameSession.gameState.cardsToDraw ?? 0) !== 1 ? 'S' : ''
            }...`
        } else if (gameSession.isChoosingCard) {
            result.message = 'CHOOSE CARD TO KEEP'
            result.showSkip = true
        } else if (gameSession.isSolarFlares) {
            result.message = 'ACTIVATE AN OUTER STATION'
            result.showSkip = true
        }
        return result
    })

    $effect(() => {
        if (gameSession.validActionTypes.length === 1) {
            const singleAction = gameSession.validActionTypes[0]
            chooseAction(singleAction)
        } else if (gameSession.validActionTypes.length === 0) {
            gameSession.resetAction()
        }

        if (gameSession.isMoving) {
            chooseMove()
        }
    })

    function chooseMove() {
        if (!canMove) {
            return
        }
        gameSession.chosenActionCategory = ActionCategory.Move
        if (gameSession.myPlayerState && !gameSession.myPlayerState.hasSundiversOnTheBoard()) {
            gameSession.chosenMothership = gameSession.myPlayerState.playerId
        }
    }

    function chooseConvert() {
        if (!canConvert) {
            return
        }
        gameSession.chosenActionCategory = ActionCategory.Convert
    }

    function chooseActivate() {
        if (!canActivate) {
            return
        }
        gameSession.chosenActionCategory = ActionCategory.Activate
    }

    async function chooseBonus() {
        await gameSession.activateBonus()
    }

    async function pass() {
        await gameSession.pass()
    }

    const cardPickerAnimator = new CardPickerAnimator(gameSession)
    cardPickerAnimator.register()
</script>

<div class="flex flex-col mb-2 sol-font-bold text-[#ad9c80] gap-y-2">
    <Header />

    {#if !gameSession.acting}
        <div class="p-2 flex flex-row flex-wrap justify-center items-center gap-x-4">
            <div class="w-fit me-4 leading-tight text-center">
                CHOOSE<br />AN ACTION
            </div>
            <button
                onclick={chooseMove}
                class="{!canMove
                    ? 'opacity-30'
                    : 'hover:border-[#ad9c80]'} w-fit box-border h-[52px] flex items-center justify-center p-2 px-4 bg-transparent border border-transparent rounded-lg"
                ><MoveArrows />
                <div class="ms-3">MOVE</div></button
            >
            <button
                onclick={chooseConvert}
                class="{!canConvert
                    ? 'opacity-30'
                    : 'hover:border-[#ad9c80]'} w-fit box-border h-[52px] flex items-center justify-center p-2 px-4 bg-transparent border border-transparent rounded-lg"
                ><ConvertAtom />
                <div class="ms-3">CONVERT</div></button
            >
            <button
                onclick={chooseActivate}
                class="{!canActivate
                    ? 'opacity-30'
                    : 'hover:border-[#ad9c80]'} w-fit box-border h-[52px] flex items-center justify-center p-2 px-4 bg-transparent border border-transparent rounded-lg"
                ><ActivateBolt />
                <div class="ms-3">ACTIVATE</div></button
            >
        </div>
    {:else}
        <!-- Call to action -->
        <div class="header-grid grid h-[50px]">
            {#if callToAction.message}
                {#key callToAction}
                    <div
                        in:fade={{ duration: 300, delay: 100 }}
                        out:fade={{ duration: 100 }}
                        class="ms-3 py-2 flex flex-row justify-center items-center h-[50px]"
                    >
                        <div class="me-2">{callToAction.message}</div>
                        {#if callToAction.showSkip}
                            <button
                                onclick={pass}
                                class="w-fit box-border py-1 px-2 bg-transparent border border-transparent hover:border-[#ad9c80] rounded-lg"
                                >SKIP</button
                            >
                        {:else if callToAction.yesNo}
                            <button
                                onclick={chooseBonus}
                                class="w-fit box-border py-1 px-2 bg-transparent border border-transparent hover:border-[#ad9c80] rounded-lg"
                                >YES</button
                            >
                            <button
                                onclick={pass}
                                class="w-fit box-border py-1 px-2 bg-transparent border border-transparent hover:border-[#ad9c80] rounded-lg"
                            >
                                NO</button
                            >
                        {/if}
                    </div>
                {/key}
            {/if}
        </div>
    {/if}

    {#if gameSession.drawnCards.length > 0 || gameSession.isSolarFlares || gameSession.isChoosingCard}
        <CardPicker animator={cardPickerAnimator} />
    {:else if (moveChosen || gameSession.isMoving) && (gameSession.chosenSource || gameSession.chosenMothership) && !gameSession.chosenNumDivers}
        <LaunchPicker />
    {:else if convertChosen && !gameSession.chosenConvertType}
        <ConvertPicker />
    {/if}
</div>

<style>
    .panel-grid > * {
        grid-area: 1 / 1;
    }
</style>
