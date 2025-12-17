<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import Sundiver from './Sundiver.svelte'
    import { sameCoordinates, type OffsetCoordinates } from '@tabletop/common'
    import Floater from '$lib/utils/Floater.svelte'

    let {
        coords
    }: {
        coords: OffsetCoordinates
    } = $props()

    let gameSession = getContext('gameSession') as SolGameSession
    let borderColor = $derived(gameSession.colors.getPlayerColor(gameSession.myPlayer?.id))

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
    }
</script>

<Floater placement="top" reference={`#board-picker-ref`} offset={20}>
    <div
        class="flex flex-col justify-center items-center space-y-2 rounded-lg dark:bg-black/90 p-2"
    >
        <div class="sol-font text-xs select-none text-[#ad9c80] tracking-widest">CHOOSE</div>
        <div class="flex flex-row justify-center items-center gap-x-2">
            {#each players as playerId}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24px"
                    height="32px"
                    viewBox="0 0 24 32"
                >
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
    </div>
</Floater>
