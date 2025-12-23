<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'

    import Header from './Header.svelte'

    let gameSession = getContext('gameSession') as SolGameSession
</script>

<div class="flex flex-col mb-2 sol-font-bold text-[#ad9c80] gap-y-2 uppercase">
    <Header />

    <div class="panel-grid grid h-[50px]"></div>
</div>

<style>
    .panel-grid > * {
        grid-area: 1 / 1;
    }
</style>
