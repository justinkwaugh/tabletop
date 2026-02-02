<script lang="ts">
    import type { ContainerGameSession } from '$lib/model/ContainerGameSession.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    let gameSession = getGameSession() as ContainerGameSession
</script>

<div class="relative w-[1280px] h-[1280px] bg-black"></div>
