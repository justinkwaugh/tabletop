<script lang="ts">
    import PanelBlocks from '$lib/components/panel/PanelBlocks.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    /**
     * The action panel: what this seat can do now, read from the session's panels, which read the
     * logic's offers. It restates no rule.
     */
    const gameSession = getGameSession()
</script>

<PanelBlocks view={gameSession.actionPanel} pointer={gameSession} />
