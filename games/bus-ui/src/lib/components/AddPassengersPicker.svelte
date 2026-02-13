<script lang="ts">
    import { Floater } from '@tabletop/frontend-components'
    import PassengerOptionIcon from './PassengerOptionIcon.svelte'
    import type { BusGameSession } from '$lib/model/session.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession() as BusGameSession

    let floater: Floater
    let optionChosen = $state(false)

    const passengerOptions = $derived.by(() => {
        const maxPassengersByActions = Math.max(
            0,
            gameSession.gameState.numAllowedActions() - gameSession.gameState.actionsTaken
        )
        const maxPassengers = Math.min(maxPassengersByActions, gameSession.gameState.passengers.length)
        return Array.from({ length: maxPassengers }, (_, index) => index + 1)
    })

    async function choose(numPassengers: number) {
        const stationId = gameSession.chosenPassengerStationId
        if (!stationId) {
            return
        }

        optionChosen = true
        floater?.close()
        await gameSession.addPassengers(stationId, numPassengers)
    }

    function handleClose() {
        if (optionChosen) {
            return
        }

        gameSession.chosenPassengerStationId = undefined
    }
</script>

<Floater
    bind:this={floater}
    placement="top"
    offset={16}
    reference="#bus-add-passengers-picker-ref"
    onClose={handleClose}
>
    <div
        class="rounded-xl border-2 border-[#7c8a9c] bg-[#e4ebf1]/96 px-1 py-0.5 shadow-[0_8px_18px_rgba(0,0,0,0.24)]"
    >
        <div class="pt-2 px-2 text-center text-[12px] leading-none text-[#333] font-medium">
            How many?
        </div>
        <div class="flex items-center justify-center gap-0">
            {#each passengerOptions as passengerCount (passengerCount)}
                <button
                    type="button"
                    class="flex h-[56px] w-[30px] items-center justify-center rounded-lg border border-transparent bg-transparent p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff27a] focus-visible:ring-offset-1 focus-visible:ring-offset-[#7c8a9c]"
                    aria-label={`Add ${passengerCount} passenger${passengerCount === 1 ? '' : 's'}`}
                    onclick={() => choose(passengerCount)}
                >
                    <PassengerOptionIcon count={passengerCount} width={20} height={36} />
                </button>
            {/each}
        </div>
    </div>
</Floater>
