<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import CommanderFlag from './CommanderFlag.svelte'

    const gameSession = getGameSession()
</script>

{#each gameSession.flags as flag (flag.key)}
    <CommanderFlag {flag} view={gameSession.flagView} />
{/each}
