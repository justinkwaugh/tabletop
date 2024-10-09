<script lang="ts">
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { Button } from 'flowbite-svelte'
    import { fade } from 'svelte/transition'
    let gameSession = getContext('gameSession') as EstatesGameSession

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
        <Button onclick={(event: any) => embezzle(event)} size="xs" color="light"
            >Steal $1 First</Button
        >
    </div>
{/if}
