<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import MoveArrows from '$lib/images/movearrows.svelte'
    import ConvertAtom from '$lib/images/convertatom.svelte'
    import ActivateBolt from '$lib/images/activatebolt.svelte'
    import { MachineState } from '@tabletop/sol'
    import { Button } from 'flowbite-svelte'
    import { slide, fade } from 'svelte/transition'

    let gameSession = getContext('gameSession') as SolGameSession

    async function chooseAction(action: string) {
        switch (action) {
            default:
                gameSession.chosenAction = action
                break
        }
    }

    const instructions = $derived.by(() => {
        switch (gameSession.chosenAction) {
            default:
                return 'Action here'
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
</script>

<div
    class="sol-font mb-2 rounded-lg p-2 flex flex-row flex-wrap justify-center items-center gap-x-4 text-[#ad9c80]"
>
    <!-- <div class="flex flex-col justify-center items-center mx-8">
        <h1 class="text-lg">{instructions}</h1>
    </div> -->
    <div class="flex sol-font-bold me-4 leading-tight text-center">CHOOSE<br />AN ACTION</div>
    <div class="flex">
        <button
            class="box-border h-[52px] flex items-center justify-center p-2 px-4 bg-transparent hover:border hover:border-[#ad9c80] rounded-lg sol-font-bold"
            ><MoveArrows />
            <div class="ms-3">MOVE</div></button
        >
    </div>
    <div class="flex">
        <button
            class="opacity-50 box-border h-[52px] flex items-center justify-center p-2 px-4 bg-transparent hover:border hover:border-[#ad9c80] rounded-lg sol-font-bold"
            ><ConvertAtom />
            <div class="ms-3">CONVERT</div></button
        >
    </div>
    <div class="flex">
        <button
            class="opacity-50 box-border h-[52px] flex items-center justify-center p-2 px-4 bg-transparent hover:border hover:border-[#ad9c80] rounded-lg sol-font-bold"
            ><ActivateBolt />
            <div class="ms-3">ACTIVATE</div></button
        >
    </div>
</div>
