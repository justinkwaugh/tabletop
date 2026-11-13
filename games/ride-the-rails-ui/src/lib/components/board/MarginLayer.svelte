<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { seatInitials } from '$lib/utils/seatCards.js'
    import RailroadStrip from './RailroadStrip.svelte'
    import RoundTrack from './RoundTrack.svelte'
    import TranscontinentalClaim from './TranscontinentalClaim.svelte'
    import TurnOrderTrack from './TurnOrderTrack.svelte'

    let { viewScale }: { viewScale: number } = $props()

    const gameSession = getGameSession()

    const initials = $derived(
        seatInitials(
            gameSession.game.players.map((player) => ({ playerId: player.id, name: player.name }))
        )
    )
</script>

<!-- Contract, The table: on desktop the margin panels sit in the board's fixed margin; on phones
     they move above the board (Phone layout). -->
<g class="margin max-sm:hidden">
    <RoundTrack />
    <TurnOrderTrack {viewScale} {initials} />
    <TranscontinentalClaim {viewScale} {initials} />
    <RailroadStrip {viewScale} {initials} />
</g>
