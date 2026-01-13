<script lang="ts">
import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { Button } from 'flowbite-svelte'
    import { fadeIn, fadeOut } from '$lib/utils/animations'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let { hidden, ...others }: { hidden?: boolean } = $props()
    let gameSession = getGameSession() as EstatesGameSession

    let ref: HTMLDivElement

    async function pass(event: any) {
        event.stopPropagation()
        await gameSession.placeBid(0)
    }

    async function placeBid(event: any) {
        event.stopPropagation()
        await gameSession.placeBid(Math.max(gameSession.currentBid, gameSession.validBid))
        gameSession.currentBid = 0
    }

    $effect(() => {
        if (hidden) {
            fadeOut({ object: ref, duration: 0.2 })
        } else {
            fadeIn({ object: ref, duration: 0.2 })
        }
    })
</script>

<div
    bind:this={ref}
    class="flex flex-row justify-center items-center gap-x-2 z-30 opacity-0"
    {...others}
>
    <Button onclick={(event: any) => pass(event)} size="xs" color="light">Pass</Button>
    <Button onclick={(event: any) => placeBid(event)} size="xs">Bid</Button>
</div>
