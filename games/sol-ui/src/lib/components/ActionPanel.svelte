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

    let gameSession = getContext('gameSession') as SolGameSession

    async function chooseAction(action: string) {
        switch (action) {
            default:
                gameSession.chosenAction = action
                break
        }
    }

    const canMove = $derived(
        gameSession.validActionTypes.includes(ActionType.Launch) ||
            gameSession.validActionTypes.includes(ActionType.Fly) ||
            gameSession.validActionTypes.includes(ActionType.Hurl)
    )
    const canConvert = $derived(gameSession.validActionTypes.includes(ActionType.Convert))
    const canActivate = $derived(gameSession.validActionTypes.includes(ActionType.Activate))

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

    function chooseBonus() {
        gameSession.activateBonus()
    }

    function pass() {
        gameSession.pass()
    }

    let moveChosen = $derived(gameSession.chosenActionCategory === ActionCategory.Move)
    let convertChosen = $derived(gameSession.chosenActionCategory === ActionCategory.Convert)
    let activateChosen = $derived(gameSession.chosenActionCategory === ActionCategory.Activate)
</script>

<div class="flex flex-col mb-2 sol-font-bold text-[#ad9c80] gap-y-2">
    <Header />
    {#if moveChosen || gameSession.isMoving}
        {#if !gameSession.chosenMothership && !gameSession.chosenSource}
            <div class="ms-3 py-2 flex flex-row justify-center items-center">
                <div class="me-2">CHOOSE A MOVEMENT SOURCE</div>
                <button
                    onclick={pass}
                    class="w-fit box-border py-1 px-2 bg-transparent border border-transparent hover:border-[#ad9c80] rounded-lg"
                >
                    SKIP</button
                >
            </div>
        {/if}
        {#if gameSession.chosenSource && !gameSession.chosenNumDivers}
            <div class="ms-3 py-2 flex flex-row justify-center items-center">HOW MANY TO MOVE?</div>
            <LaunchPicker />
        {/if}
        {#if gameSession.chosenMothership && !gameSession.chosenNumDivers}
            <div class="ms-3 py-2 flex flex-row justify-center items-center">
                HOW MANY TO LAUNCH?
            </div>
            <LaunchPicker />
        {/if}
        {#if gameSession.chosenNumDivers}
            <div class="ms-3 py-2 flex flex-row justify-center items-center">
                CHOOSE A DESTINATION FOR {gameSession.chosenNumDivers} SUNDIVER{gameSession.chosenNumDivers >
                1
                    ? 'S'
                    : ''}
            </div>
        {/if}
    {/if}
    {#if !moveChosen && !convertChosen && !activateChosen && !gameSession.isMoving && !gameSession.isActivating && !gameSession.isChoosingCard && !gameSession.isSolarFlares}
        <div class="p-2 flex flex-row flex-wrap justify-center items-center gap-x-4">
            <div class="w-fit me-4 leading-tight text-center">CHOOSE<br />AN ACTION</div>
            <button
                onclick={chooseMove}
                class="{!canMove || convertChosen || activateChosen
                    ? 'opacity-30'
                    : ''} w-fit box-border h-[52px] flex items-center justify-center p-2 px-4 bg-transparent border border-transparent hover:border-[#ad9c80] rounded-lg"
                ><MoveArrows />
                <div class="ms-3">MOVE</div></button
            >
            <button
                onclick={chooseConvert}
                class="{!canConvert || moveChosen || activateChosen
                    ? 'opacity-30'
                    : ''} w-fit box-border h-[52px] flex items-center justify-center p-2 px-4 bg-transparent border border-transparent hover:border-[#ad9c80] rounded-lg"
                ><ConvertAtom />
                <div class="ms-3">CONVERT</div></button
            >
            <button
                onclick={chooseActivate}
                class="{!canActivate || moveChosen || convertChosen
                    ? 'opacity-30'
                    : ''} w-fit box-border h-[52px] flex items-center justify-center p-2 px-4 bg-transparent border border-transparent hover:border-[#ad9c80] rounded-lg"
                ><ActivateBolt />
                <div class="ms-3">ACTIVATE</div></button
            >
        </div>
    {/if}
    {#if convertChosen}
        {#if !gameSession.chosenConvertType}
            <div class="ms-3 py-2 flex flex-row justify-center items-center">
                WHAT WILL YOU CONVERT?
            </div>
            <ConvertPicker />
        {:else if gameSession.diverCellChoices}
            <div class="ms-3 py-2 flex flex-row justify-center items-center">CHOOSE A SUNDIVER</div>
        {:else if !gameSession.chosenDestination}
            <div class="ms-3 py-2 flex flex-row justify-center items-center">CHOOSE A LOCATION</div>
        {/if}
    {/if}
    {#if activateChosen}
        <div class="ms-3 py-2 flex flex-row justify-center items-center">CHOOSE A STATION</div>
    {/if}
    {#if gameSession.isActivating}
        {#if gameSession.gameState.activation && !gameSession.gameState.activation.currentStationId}
            <div class="ms-3 py-2 flex flex-row justify-center items-center">
                <div class="me-2">ACTIVATE ANOTHER?</div>
                <button
                    onclick={pass}
                    class="w-fit box-border py-1 px-2 bg-transparent border border-transparent hover:border-[#ad9c80] rounded-lg"
                >
                    SKIP</button
                >
            </div>
        {:else}
            <div class="ms-3 py-2 flex flex-row justify-center items-center">
                <div class="me-2">CLAIM THE BONUS?</div>
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
            </div>
        {/if}
    {/if}
    {#if gameSession.isChoosingCard}
        <div class="ms-3 py-2 flex flex-row justify-center items-center">CHOOSE CARD TO KEEP</div>
        <CardPicker />
    {/if}
    {#if gameSession.isSolarFlares}
        <div class="ms-3 py-2 flex flex-row justify-center items-center">
            <div class="me-2">ACTIVATE AN OUTER STATION</div>
            <button
                onclick={pass}
                class="w-fit box-border py-1 px-2 bg-transparent border border-transparent hover:border-[#ad9c80] rounded-lg"
            >
                SKIP</button
            >
        </div>
    {/if}
</div>
