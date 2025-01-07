<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import MoveArrows from '$lib/images/movearrows.svelte'
    import ConvertAtom from '$lib/images/convertatom.svelte'
    import ActivateBolt from '$lib/images/activatebolt.svelte'
    import { ActionCategory } from '$lib/definition/actionCategory.js'
    import LaunchPicker from './LaunchPicker.svelte'

    let gameSession = getContext('gameSession') as SolGameSession

    async function chooseAction(action: string) {
        switch (action) {
            default:
                gameSession.chosenAction = action
                break
        }
    }

    $effect(() => {
        if (gameSession.validActionTypes.length === 1) {
            const singleAction = gameSession.validActionTypes[0]
            chooseAction(singleAction)
        } else if (gameSession.validActionTypes.length === 0) {
            gameSession.resetAction()
        }
    })

    function chooseMove() {
        gameSession.chosenActionCategory = ActionCategory.Move
    }

    let moveChosen = $derived(gameSession.chosenActionCategory === ActionCategory.Move)
    let convertChosen = $derived(gameSession.chosenActionCategory === ActionCategory.Convert)
    let activateChosen = $derived(gameSession.chosenActionCategory === ActionCategory.Activate)
</script>

<div class="flex flex-col mb-2 sol-font-bold text-[#ad9c80]">
    <div class="p-2 flex flex-row flex-wrap justify-center items-center gap-x-4">
        <div class="w-fit me-4 leading-tight text-center">CHOOSE<br />AN ACTION</div>
        <button
            onclick={chooseMove}
            class="{convertChosen || activateChosen
                ? 'opacity-30'
                : ''} w-fit box-border h-[52px] flex items-center justify-center p-2 px-4 bg-transparent border border-transparent hover:border-[#ad9c80] rounded-lg"
            ><MoveArrows />
            <div class="ms-3">MOVE</div></button
        >
        <button
            class="{moveChosen || activateChosen
                ? 'opacity-30'
                : ''} w-fit box-border h-[52px] flex items-center justify-center p-2 px-4 bg-transparent border border-transparent hover:border-[#ad9c80] rounded-lg"
            ><ConvertAtom />
            <div class="ms-3">CONVERT</div></button
        >
        <button
            class="{moveChosen || convertChosen
                ? 'opacity-30'
                : ''} w-fit box-border h-[52px] flex items-center justify-center p-2 px-4 bg-transparent border border-transparent hover:border-[#ad9c80] rounded-lg"
            ><ActivateBolt />
            <div class="ms-3">ACTIVATE</div></button
        >
    </div>

    {#if moveChosen}
        <div class="ms-3 flex flex-row justify-center items-center">CHOOSE A MOVEMENT SOURCE</div>
    {/if}
    <LaunchPicker />
</div>
{#if convertChosen}{/if}
{#if activateChosen}{/if}
