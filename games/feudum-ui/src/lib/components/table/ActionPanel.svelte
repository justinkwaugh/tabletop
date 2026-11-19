<script lang="ts">
    import PanelBlocks from '$lib/components/panel/PanelBlocks.svelte'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    /**
     * The action panel: what this seat can do now, read from the session's panels, which read the
     * logic's offers. It restates no rule.
     */
    const gameSession = getGameSession()
    const phone = new PhoneLayout()

    /** Contract, The bench: on a phone the send stands in the open sheet's footer, in one place. */
    let view = $derived(
        phone.phone && gameSession.benchCovers
            ? {
                  ...gameSession.actionPanel,
                  blocks: gameSession.actionPanel.blocks.filter(({ kind }) => kind !== 'primary')
              }
            : gameSession.actionPanel
    )
</script>

<PanelBlocks {view} pointer={gameSession} />
