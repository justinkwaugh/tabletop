<script lang="ts">
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import Sundiver from '$lib/components/Sundiver.svelte'
    import { sameCoordinates, type OffsetCoordinates } from '@tabletop/common'
    import { HydratedChain } from '@tabletop/sol'
    import SolPicker from './SolPicker.svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let {
        coords
    }: {
        coords: OffsetCoordinates
    } = $props()

    let gameSession = getGameSession() as SolGameSession

    let players = $derived.by(() => {
        if (!coords) {
            return []
        }
        return gameSession.gameState.board.playersWithSundiversAt(coords)
    })

    function selectSundiver(playerId: string) {
        const sundiver = gameSession.gameState.board.sundiversForPlayerAt(playerId, coords)[0]
        const entry = gameSession.chain?.find((entry) => sameCoordinates(entry.coords, coords))
        if (sundiver && entry) {
            entry.sundiverId = sundiver.id
        }

        if (
            HydratedChain.isChainComplete(gameSession.gameState, gameSession.chain!) &&
            gameSession.chain!.length % 2 === 1
        ) {
            gameSession.chainStart = 'beginning'
            gameSession.doChain()
        }
    }

    function onClose() {
        gameSession.chain = gameSession.chain?.filter((entry) => entry.sundiverId !== undefined)
    }
</script>

<SolPicker {onClose}>
    <div class="sol-font text-xs select-none text-[#ad9c80] tracking-widest">CHOOSE</div>
    <div class="flex flex-row justify-center items-center gap-x-2">
        {#each players as playerId (playerId)}
            <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="32px" viewBox="0 0 24 32">
                <Sundiver
                    color={gameSession.colors.getPlayerColor(playerId)}
                    width={24}
                    height={32}
                    fontSize={19}
                    quantity={0}
                    offBoard={true}
                    onclick={() => selectSundiver(playerId)}
                />
            </svg>
        {/each}
    </div>
</SolPicker>
