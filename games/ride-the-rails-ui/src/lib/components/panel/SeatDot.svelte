<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { playerId }: { playerId: string } = $props()

    const gameSession = getGameSession()
</script>

<span
    class="inline-block size-3 shrink-0 rounded-full border border-rtr-halo/40"
    style:background-color={gameSession.colors.getPlayerBgColorValue(playerId)}
    aria-hidden="true"
></span>
