<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ShieldIcon from '../ui/ShieldIcon.svelte'

    const gameSession = getGameSession()
</script>

<div class="flex flex-col gap-1 rounded-md border border-[#8a6a3c] bg-[#efe3c3] p-2 text-sm">
    {#if gameSession.routeSlot === undefined}
        <div>Click a face-up route marker on your city to replace it.</div>
    {:else}
        <div>
            Lay one of your markers face down in its place. Only you will know where it leads.
        </div>
        <div class="flex flex-wrap gap-1">
            {#each gameSession.replacementMarkers as value (value)}
                <button
                    class="transition-transform hover:-translate-y-0.5"
                    onclick={() => gameSession.changeRoute(value)}
                >
                    <ShieldIcon {value} size={30} />
                </button>
            {/each}
        </div>
    {/if}
</div>
