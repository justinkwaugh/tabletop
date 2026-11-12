<script lang="ts">
    import type { SpaceId } from '@tabletop/feudum'
    import { Floater } from '@tabletop/frontend-components'
    import { siteCardOf } from '$lib/model/siteCard.js'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import SiteCard from './SiteCard.svelte'

    /**
     * The site card beside its disc (contract: Site card), from the state the table shows, so it
     * works in History View. A manual popover: a second press on the disc, its close or Escape
     * closes it.
     */
    let { spaceId, onClose }: { spaceId: SpaceId; onClose: () => void } = $props()

    const gameSession = getGameSession()
    const phone = new PhoneLayout()

    let card = $derived(
        siteCardOf(gameSession.gameState, spaceId, (playerId) =>
            gameSession.getPlayerName(playerId)
        )
    )
    const popoverAttributes = $derived({
        role: 'dialog',
        'aria-label': card.title,
        style: 'margin:0;border:0;padding:0;overflow:visible'
    })
</script>

{#key spaceId}
    <Floater
        reference={`[data-board-surface] [data-world="disc:${spaceId}"]`}
        placement={phone.phone ? 'top' : 'right-start'}
        strategy="fixed"
        trigger="manual"
        {...popoverAttributes}
    >
        <SiteCard {card} paintOf={gameSession.paintOf} {onClose} />
    </Floater>
{/key}
