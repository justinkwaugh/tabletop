<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import MoveArrows from '$lib/images/movearrows.svelte'
    import ConvertAtom from '$lib/images/convertatom.svelte'
    import ActivateBolt from '$lib/images/activatebolt.svelte'
    import LaunchPicker from './LaunchPicker.svelte'
    import Header from './Header.svelte'
    import {
        ActionType,
        EffectType,
        HydratedActivate,
        HydratedActivateEffect,
        HydratedFly
    } from '@tabletop/sol'
    import ConvertPicker from './ConvertPicker.svelte'
    import CardPicker from './CardPicker.svelte'
    import { fade } from 'svelte/transition'
    import { CardPickerAnimator } from '$lib/animators/cardPickerAnimator.js'
    import SuitPicker from './SuitPicker.svelte'
    import HatchPicker from './HatchPicker.svelte'
    import AccelerationPicker from './AccelerationPicker.svelte'
    import MovementPicker from './MovementPicker.svelte'

    enum YesActions {
        ClusterEffect = 'ClusterEffect',
        ActivateBonus = 'ActivateBonus',
        SqueezeEffect = 'SqueezeEffect',
        TeleportEffect = 'TeleportEffect'
    }

    enum NoActions {
        Pass = 'Pass',
        NoClusterEffect = 'NoClusterEffect',
        NoSqueezeEffect = 'NoSqueezeEffect',
        NoTeleportEffect = 'NoTeleportEffect'
    }

    type CallToAction = {
        message?: string
        showSkip: boolean
        yesNo: boolean
        yesAction?: YesActions
        noAction?: NoActions
    }

    let gameSession = getContext('gameSession') as SolGameSession

    async function chooseAction(action: string) {
        switch (action) {
            default:
                gameSession.chosenAction = action
                break
        }
    }

    const canMove = $derived(gameSession.validActionTypes.includes(ActionType.ChooseMove))
    const canConvert = $derived(gameSession.validActionTypes.includes(ActionType.ChooseConvert))
    const canActivate = $derived(gameSession.validActionTypes.includes(ActionType.ChooseActivate))

    const callToAction = $derived.by(() => {
        const result = { message: undefined, showSkip: false, yesNo: false } as CallToAction

        if (!gameSession.myPlayer) {
            return result
        }

        if (gameSession.forcedCallToAction) {
            result.message = gameSession.forcedCallToAction
            return result
        }

        if (gameSession.isHatching) {
            if (!gameSession.hatchLocation) {
                result.message = 'CHOOSE A LOCATION TO HATCH'
            } else if (!gameSession.hatchTarget) {
                result.message = 'CHOOSE A PLAYER TO TARGET'
            }
        } else if (gameSession.isAccelerating) {
            if (!gameSession.accelerationAmount) {
                result.message = 'HOW MUCH ACCELERATION?'
            }
        } else if (gameSession.isMoving) {
            if (!gameSession.chosenMothership && !gameSession.chosenSource) {
                result.message = 'CHOOSE A MOVEMENT SOURCE'
                result.showSkip = true
            } else if (
                gameSession.chosenSource &&
                !gameSession.chosenNumDivers &&
                !gameSession.juggernautStationId
            ) {
                result.message = 'HOW MANY TO MOVE?'
            } else if (gameSession.chosenMothership && !gameSession.chosenNumDivers) {
                result.message = 'HOW MANY TO LAUNCH?'
            } else if (gameSession.gateChoices && gameSession.gateChoices.length > 0) {
                result.message = 'CHOOSE A GATE TO USE'
            } else if (gameSession.chosenNumDivers) {
                if (
                    gameSession.chosenNumDivers > 1 &&
                    gameSession.gameState.activeEffect === EffectType.Cluster &&
                    gameSession.gameState.getEffectTracking().clustersRemaining > 0 &&
                    gameSession.clusterChoice === undefined
                ) {
                    result.message = `USE CLUSTER EFFECT?`
                    result.yesNo = true
                    result.yesAction = YesActions.ClusterEffect
                    result.noAction = NoActions.NoClusterEffect
                } else if (
                    !gameSession.chosenMothership &&
                    gameSession.chosenNumDivers === 1 &&
                    gameSession.gameState.activeEffect === EffectType.Teleport &&
                    HydratedFly.canTeleport(gameSession.gameState, gameSession.myPlayer.id) &&
                    gameSession.teleportChoice === undefined
                ) {
                    result.message = 'USE TELEPORT EFFECT?'
                    result.yesNo = true
                    result.yesAction = YesActions.TeleportEffect
                    result.noAction = NoActions.NoTeleportEffect
                } else {
                    result.message = `CHOOSE A DESTINATION FOR ${gameSession.chosenNumDivers} SUNDIVER${
                        gameSession.chosenNumDivers > 1 ? 'S' : ''
                    }`
                }
            } else if (gameSession.juggernautStationId) {
                result.message = 'CHOOSE A DESTINATION FOR JUGGERNAUT'
            }
        } else if (gameSession.isConverting) {
            if (gameSession.gameState.activeEffect === EffectType.Invade) {
                if (!gameSession.chosenDestination) {
                    result.message = 'WHO WILL YOU INVADE?'
                }
            } else if (gameSession.gameState.activeEffect === EffectType.Sacrifice) {
                if (!gameSession.chosenDestination) {
                    result.message = 'WHERE WILL YOU SACRIFICE?'
                }
            } else if (!gameSession.chosenConvertType) {
                result.message = 'WHAT WILL YOU CONVERT?'
            } else if (gameSession.diverCellChoices) {
                result.message = 'CHOOSE A SUNDIVER'
            } else if (!gameSession.chosenDestination) {
                result.message = 'CHOOSE A LOCATION'
            }
        } else if (gameSession.isActivating) {
            if (
                !HydratedActivate.canActivate(gameSession.gameState, gameSession.myPlayer.id) &&
                gameSession.gameState.playerHasCardForEffect(
                    gameSession.myPlayer.id,
                    EffectType.Pulse
                ) &&
                HydratedActivateEffect.canActivatePulse(
                    gameSession.gameState,
                    gameSession.myPlayer.id
                )
            ) {
                result.message = 'ACTIVATE PULSE TO CONTINUE'
                return result
            } else if (
                !HydratedActivate.canActivate(gameSession.gameState, gameSession.myPlayer.id) &&
                gameSession.gameState.playerHasCardForEffect(
                    gameSession.myPlayer.id,
                    EffectType.Blight
                ) &&
                HydratedActivateEffect.canActivateBlight(
                    gameSession.gameState,
                    gameSession.myPlayer.id
                )
            ) {
                result.message = 'ACTIVATE BLIGHT TO CONTINUE'
                return result
            } else if (
                gameSession.gameState.activeEffect === EffectType.Blight &&
                !gameSession.chosenSource
            ) {
                result.message = 'CHOOSE A SUNDIVER TO BLIGHT WITH'
            } else if (!gameSession.gameState.activation) {
                result.message = 'CHOOSE A STATION'
            } else if (!gameSession.gameState.activation.currentStationId) {
                result.message = 'ACTIVATE ANOTHER?'
                result.showSkip = true
            } else {
                result.message = 'CLAIM THE BONUS?'
                result.yesNo = true
                result.yesAction = YesActions.ActivateBonus
                result.noAction = NoActions.Pass
            }
        } else if (gameSession.isDrawingCards) {
            if (
                gameSession.gameState.activeEffect === EffectType.Pillar &&
                !gameSession.pillarGuess
            ) {
                result.message = 'GUESS A SUIT'
            } else {
                const myPlayerState = gameSession.myPlayerState
                const squeezed =
                    gameSession.gameState.getEffectTracking().squeezed &&
                    (myPlayerState?.drawnCards ?? []).length > 0
                result.message = `DRAW ${gameSession.gameState.cardsToDraw} ${squeezed ? 'MORE ' : ''}CARD${
                    gameSession.gameState.cardsToDraw !== 1 ? 'S' : ''
                }...`
            }
        } else if (gameSession.isChoosingCard) {
            result.message = 'CHOOSE CARD TO KEEP'
            result.showSkip = true
        } else if (gameSession.isSolarFlares) {
            result.message = 'ACTIVATE AN OUTER STATION'
            result.showSkip = true
        } else if (gameSession.isCheckingEffect) {
            const myPlayerState = gameSession.myPlayerState
            if (!myPlayerState || !myPlayerState.card) {
                return result
            }
            const effect = gameSession.gameState.effects[myPlayerState.card.suit]
            result.message = `ACTIVATE ${effect.type} EFFECT?`
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

    async function chooseMove() {
        if (!canMove) {
            return
        }

        await gameSession.chooseMove()

        // if (gameSession.myPlayerState && !gameSession.myPlayerState.hasSundiversOnTheBoard()) {
        //     gameSession.chosenMothership = gameSession.myPlayerState.playerId
        // }
    }

    async function chooseConvert() {
        if (!canConvert) {
            return
        }

        await gameSession.chooseConvert()
    }

    async function chooseActivate() {
        if (!canActivate) {
            return
        }

        await gameSession.chooseActivate()
    }

    async function pass() {
        await gameSession.pass()
    }

    async function yes(action?: YesActions) {
        if (action === YesActions.ClusterEffect) {
            gameSession.clusterChoice = true
        } else if (action === YesActions.ActivateBonus) {
            await gameSession.activateBonus()
        } else if (action === YesActions.SqueezeEffect) {
            await gameSession.activateEffect(EffectType.Squeeze)
        } else if (action === YesActions.TeleportEffect) {
            gameSession.teleportChoice = true
        } else {
            throw new Error('Unknown yes action')
        }
    }

    async function no(action?: NoActions) {
        if (action === NoActions.Pass) {
            await gameSession.pass()
        } else if (action === NoActions.NoClusterEffect) {
            gameSession.clusterChoice = false
        } else if (action === NoActions.NoSqueezeEffect) {
            await gameSession.activateStation()
        } else if (action === NoActions.NoTeleportEffect) {
            gameSession.teleportChoice = false
        } else {
            throw new Error('Unknown no action')
        }
    }

    const cardPickerAnimator = new CardPickerAnimator(gameSession)
    cardPickerAnimator.register()
</script>

<div class="flex flex-col mb-2 sol-font-bold text-[#ad9c80] gap-y-2 uppercase">
    <Header />

    <div class="panel-grid grid {gameSession.acting ? 'h-[50px]' : 'h-[68px]'}">
        {#if !gameSession.acting}
            <div
                out:fade={{ duration: 100 }}
                in:fade={{ duration: 300, delay: 100 }}
                class="p-2 flex flex-row flex-wrap justify-center items-center gap-x-4"
            >
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
        {/if}
        <!-- Call to action -->
        {#key callToAction.message}
            <div
                in:fade={{ duration: 300, delay: 100 }}
                out:fade={{ duration: 100 }}
                class="ms-3 py-2 flex flex-row justify-center items-center h-[50px] {callToAction.message
                    ? ''
                    : 'pointer-events-none'}"
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
                        onclick={() => yes(callToAction.yesAction)}
                        class="w-fit box-border py-1 px-2 bg-transparent border border-transparent hover:border-[#ad9c80] rounded-lg"
                        >YES</button
                    >
                    <button
                        onclick={() => no(callToAction.noAction)}
                        class="w-fit box-border py-1 px-2 bg-transparent border border-transparent hover:border-[#ad9c80] rounded-lg"
                    >
                        NO</button
                    >
                {/if}
            </div>
        {/key}
    </div>

    {#if gameSession.isHatching && !gameSession.hatchTarget}
        <div in:fade={{ duration: 200, delay: 100 }} out:fade={{ duration: 100 }}>
            <HatchPicker />
        </div>
    {:else if gameSession.isAccelerating && !gameSession.accelerationAmount}
        <div in:fade={{ duration: 200, delay: 100 }} out:fade={{ duration: 100 }}>
            <AccelerationPicker />
        </div>
    {:else if (gameSession.isSolarFlares || gameSession.isChoosingCard || gameSession.isDrawingCards) && gameSession.drawnCards.length > 0}
        <CardPicker animator={cardPickerAnimator} />
    {:else if gameSession.isMoving && (gameSession.chosenSource || gameSession.chosenMothership) && !gameSession.chosenNumDivers && !gameSession.juggernautStationId}
        <MovementPicker coords={gameSession.chosenSource ?? { row: 0, col: 0 }} />
    {:else if gameSession.isConverting && !gameSession.chosenConvertType}
        <div in:fade={{ duration: 200, delay: 100 }} out:fade={{ duration: 100 }}>
            <ConvertPicker />
        </div>
    {:else if gameSession.gameState.activeEffect === EffectType.Pillar && !gameSession.pillarGuess}
        <div in:fade={{ duration: 200, delay: 100 }} out:fade={{ duration: 100 }}>
            <SuitPicker />
        </div>
    {/if}
</div>

<style>
    .panel-grid > * {
        grid-area: 1 / 1;
    }
</style>
