<script lang="ts">
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import Counterclockwise from '$lib/images/counterclockwise.svelte'
    import Clockwise from '$lib/images/clockwise.svelte'
    import SolPicker from './SolPicker.svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import { MachineState, type HydratedSolGameState } from '@tabletop/sol'

    let gameSession = getGameSession() as SolGameSession
    let amount: number = $state(0)
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
        picker.close()

        gameSession.accelerationAmount = amount
        await gameSession.accelerate()
    }

    function attachCloseOnStateChange(_element: HTMLElement) {
        // The player cannot dismiss this picker, so closing it never undoes. A State that is
        // replaced but still Accelerating rebuilds the mothership preview, so start over at zero.
        const onGameStateChange = async ({ to }: { to: HydratedSolGameState }) => {
            if (to.machineState === MachineState.Accelerating) {
                amount = 0
            } else {
                picker?.close()
            }
        }

        gameSession.addGameStateChangeListener(onGameStateChange)

        return () => {
            gameSession.removeGameStateChangeListener(onGameStateChange)
        }
    }
</script>

<SolPicker bind:this={picker} offset={8} trigger="manual">
    <div
        {@attach attachCloseOnStateChange}
        class="flex flex-row flex-wrap justify-center items-center gap-x-2"
    >
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
