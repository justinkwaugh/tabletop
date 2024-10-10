<script lang="ts">
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { Button } from 'flowbite-svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession

    async function pass(event: any) {
        event.stopPropagation()
        await gameSession.placeBid(0)
    }

    async function placeBid(event: any) {
        event.stopPropagation()
        await gameSession.placeBid(Math.max(gameSession.currentBid, gameSession.validBid))
        gameSession.currentBid = 0
    }
</script>

<div class="flex flex-row justify-center items-center gap-x-2 z-30">
    <Button onclick={(event: any) => pass(event)} size="xs" color="light">Pass</Button>
    <Button onclick={(event: any) => placeBid(event)} size="xs">Bid</Button>
</div>
