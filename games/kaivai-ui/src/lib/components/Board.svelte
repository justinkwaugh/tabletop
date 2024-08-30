<script lang="ts">
    import { getContext } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'

    let gameSession = getContext('gameSession') as KaivaiGameSession
</script>

<div class="relative w-[1280px] h-[1322px]"></div>
