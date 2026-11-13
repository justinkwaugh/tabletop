<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { drawsSeatInitials } from '$lib/utils/boardGeometry.js'
    import { seatInitials } from '$lib/utils/seatCards.js'
    import RailroadStrip from './RailroadStrip.svelte'
    import RoundTrack from './RoundTrack.svelte'
    import TranscontinentalClaim from './TranscontinentalClaim.svelte'
    import TurnOrderTrack from './TurnOrderTrack.svelte'

    let { viewScale }: { viewScale: number } = $props()

    const gameSession = getGameSession()

    const NO_INITIALS: ReadonlyMap<string, string> = new Map()

    // Seat initials are drawn only once the view is large enough to read them.
    const initials = $derived(
        drawsSeatInitials(viewScale)
            ? seatInitials(
                  gameSession.game.players.map((player) => ({
                      playerId: player.id,
                      name: player.name
                  }))
              )
            : NO_INITIALS
    )
</script>

<!-- Contract, The table: on desktop the margin panels sit in the board's fixed margin; on phones
     they move above the board (Phone layout). -->
<g class="margin max-sm:hidden">
    <RoundTrack />
    <TurnOrderTrack {initials} />
    <TranscontinentalClaim {initials} />
    <RailroadStrip {initials} />
</g>
