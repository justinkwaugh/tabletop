<script lang="ts">
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { Button } from 'flowbite-svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let { hidden, ...others }: { hidden?: boolean } = $props()
    let gameSession = getGameSession() as EstatesGameSession

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

<div
    class:hud-hidden={hidden}
    class="flex flex-row justify-center items-center gap-x-2 z-30 hud-fade"
    {...others}
>
    <Button onclick={(event: any) => pass(event)} size="xs" color="light">Pass</Button>
    <Button onclick={(event: any) => placeBid(event)} disabled={!gameSession.canAffordBid} size="xs"
        >Bid</Button
    >
</div>
