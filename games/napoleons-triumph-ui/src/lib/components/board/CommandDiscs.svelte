<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { COMMAND_DISC_RADIUS } from '$lib/utils/commandTrack.js'

    const gameSession = getGameSession()
</script>

<g filter="url(#nt-contact-shadow)" class="pointer-events-none">
    {#each gameSession.commandDiscs as disc (`${disc.x}:${disc.y}`)}
        <circle cx={disc.x} cy={disc.y} r={COMMAND_DISC_RADIUS} fill="#1d1b18" data-command-disc
        ></circle>
    {/each}
</g>
