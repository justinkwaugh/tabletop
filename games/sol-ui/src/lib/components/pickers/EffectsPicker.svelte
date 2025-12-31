<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import Floater from '$lib/utils/Floater.svelte'
    import SuitMarker from '../SuitMarker.svelte'
    import { Effects, EffectType, Suit } from '@tabletop/sol'

    let gameSession = getContext('gameSession') as SolGameSession

    let selectedSuit = $state<Suit | undefined>(undefined)

    function updateEffectForSuit(suit: Suit, effectType: EffectType) {
        selectedSuit = undefined
        gameSession.updateEffectForSuit(suit, effectType)
    }
</script>

<Floater placement="bottom" reference={`#sol-header`}>
    <div
        class="flex flex-col justify-center items-center space-y-2 rounded-lg dark:bg-black/90 p-2 border-1 border-[#ad9c80]"
    >
        <div class="flex flex-row flex-wrap justify-center items-center gap-x-2">
            {#each Object.entries(gameSession.gameState.effects) as [suit, effect] (suit)}
                <div class="flex flex-col justify-center items-center">
                    <SuitMarker
                        onclick={() => (selectedSuit = suit as Suit)}
                        suit={suit as Suit}
                        class="w-[40px] h-[40px]"
                    />
                    <div class="text-sm text-center text-[#ad9c80] tracking-widest mt-1">
                        {effect.type}
                    </div>
                </div>
            {/each}
        </div>
        {#if selectedSuit}
            <div
                class="border-2 border-[#ad9c80] w-full h-full flex flex-row flex-wrap justify-center items-center space-x-2"
            >
                {#each Effects as effect (effect.type)}
                    <button
                        onclick={() => updateEffectForSuit(selectedSuit!, effect.type)}
                        class="text-sm text-center text-[#ad9c80] tracking-widest p-1 border-1 border-transparent hover:border-[#ad9c80] rounded-lg"
                        >{effect.type}</button
                    >
                {/each}
            </div>
        {/if}
    </div>
</Floater>
