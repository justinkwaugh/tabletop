<script lang="ts">
import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { Button } from 'flowbite-svelte'
    import { fade } from 'svelte/transition'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    let gameSession = getGameSession() as EstatesGameSession

    async function embezzle(event: any) {
        event.stopPropagation()
        await gameSession.embezzle()
    }
</script>

{#if !gameSession.gameState.embezzled}
    <div
        transition:fade={{ duration: 200 }}
        class="flex flex-row justify-center items-center gap-x-2 z-30"
    >
        {#if gameSession.myPlayerState?.money ?? 0 > 0}
            <Button onclick={(event: any) => embezzle(event)} size="xs" color="light"
                >Steal $1 First</Button
            >
        {/if}
    </div>
{/if}
