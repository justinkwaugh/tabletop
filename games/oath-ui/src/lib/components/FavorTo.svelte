<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { favorToken } from '$lib/images/tileImages.js'

    // R-6.7, R-6.8 — a price paid to a seat, as a toll reads: "5 [favor] to <chip>". The count is
    // gold, as a cost is, where the label is not already gold.
    let { favor, playerId, gold }: { favor: number; playerId: string; gold: boolean } = $props()

    const token = favorToken()
</script>

<span class="inline-flex items-center gap-1 whitespace-nowrap"
    ><span class="inline-flex items-center gap-[0.2em]"
        ><span class:text-oath-accent={gold}>{favor}</span><img
            class="h-[1.1em] w-auto"
            src={token.src}
            width={token.width}
            height={token.height}
            alt="favor"
        /></span
    > to <PlayerName {playerId} /></span
>
