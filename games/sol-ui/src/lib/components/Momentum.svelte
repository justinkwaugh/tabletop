<script lang="ts">
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import Ark from '$lib/images/ark.svelte'
    import { flip } from 'svelte/animate'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let gameSession = getGameSession() as SolGameSession

    const playersOrderedByMomentum = $derived.by(() => {
        return [...gameSession.gameState.players].sort((a, b) => {
            return a.momentum - b.momentum
        })
    })
</script>

<div
    class="-mt-2 flex flex-row justify-between items-start bg-black py-2 ps-2 border-b-1 border-[#ad9c80]"
>
    <div class="sol-font-bold text-[#ad9c80] leading-none">MOMENTUM</div>
    <div class="flex justify-center items-center space-x-1">
        {#each playersOrderedByMomentum as playerState (playerState.playerId)}
            <div animate:flip={{ duration: 200 }}>
                <svg
                    class="pointer-events-none"
                    width="32"
                    height="32"
                    viewBox="0 0 32 32"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <Ark
                        width={32}
                        height={32}
                        color={gameSession.colors.getPlayerColor(playerState.playerId)}
                    />
                    <text
                        class="select-none sol-font"
                        style="letter-spacing:0.1em"
                        x="16.5"
                        y="17"
                        text-anchor="middle"
                        dominant-baseline="middle"
                        font-size="12"
                        stroke-width="1"
                        stroke="#dddddd"
                        opacity="1"
                        fill="#dddddd">{playerState.momentum}</text
                    >
                </svg>
            </div>
        {/each}
    </div>
</div>
