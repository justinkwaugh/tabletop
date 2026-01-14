<script lang="ts">
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import Counterclockwise from '$lib/images/counterclockwise.svelte'
    import Clockwise from '$lib/images/clockwise.svelte'
    import SolPicker from './SolPicker.svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let gameSession = getGameSession() as SolGameSession
    let amount: number = $state(0)
    let amountChosen = $state(false)
    let picker: SolPicker

    let maxAmount = $derived(gameSession.gameState.board.numMothershipLocations - 1)

    function increaseAmount() {
        if (amount < maxAmount) {
            amount += 1
            for (const key of gameSession.mothershipLocations.keys()) {
                const currentValue = gameSession.mothershipLocations.get(key) ?? 0
                const newValue = currentValue - 1
                gameSession.mothershipLocations.set(key, currentValue - 1)
            }
        }
    }

    function decreaseAmount() {
        if (amount > 1) {
            amount -= 1
            for (const key of gameSession.mothershipLocations.keys()) {
                const currentValue = gameSession.mothershipLocations.get(key) ?? 0
                gameSession.mothershipLocations.set(key, currentValue + 1)
            }
        }
    }

    async function selectAmount() {
        if (amount === 0) {
            return
        }
        amountChosen = true
        picker.toggle()

        gameSession.accelerationAmount = amount
        await gameSession.accelerate()
    }

    async function onClose() {
        if (!amountChosen) {
            await gameSession.undo()
        }
    }
</script>

<SolPicker bind:this={picker} {onClose} offset={8}>
    <div class="flex flex-row flex-wrap justify-center items-center gap-x-2">
        <button
            onclick={increaseAmount}
            class="tracking-none leading-none text-4xl px-2 select-none rounded-full border-1 border-transparent overflow-hidden"
            ><Counterclockwise
                fill={amount < maxAmount ? '#ad9c80' : '#373128'}
                stroke={amount < maxAmount ? '#ad9c80' : '#373128'}
                width={30}
                height={35}
            /></button
        >
        <button
            onclick={() => selectAmount()}
            class="tracking-widest {amount > 0 ? 'text-[#ad9c80]' : 'text-[#373128]'}"
        >
            ACCEPT
        </button>
        <button
            onclick={decreaseAmount}
            class="tracking-none leading-none text-4xl px-2 select-none border-1 border-transparent rounded-full overflow-hidden"
            ><Clockwise
                fill={amount > 1 ? '#ad9c80' : '#373128'}
                stroke={amount > 1 ? '#ad9c80' : '#373128'}
                width={30}
                height={35}
            /></button
        >
    </div>
</SolPicker>
