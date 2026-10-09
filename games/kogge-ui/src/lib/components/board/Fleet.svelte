<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cogPosition } from '$lib/utils/fleet.js'
    import CogShip from '../art/CogShip.svelte'
    import GuildMasterPawn from '../art/GuildMasterPawn.svelte'

    const gameSession = getGameSession()
    const fleet = $derived(gameSession.fleetState)
    const cogs = $derived(
        fleet.players.flatMap((player) => {
            const position = cogPosition(gameSession.geometry, fleet, player.playerId)
            return position ? [{ playerId: player.playerId, position }] : []
        })
    )
    const guildMaster = $derived(gameSession.geometry.guildMasterSpot(fleet.guildMaster.city))
</script>

<g pointer-events="none">
    <g transform="translate({guildMaster.x} {guildMaster.y})">
        <g {@attach gameSession.fleetAnimator.attachGuildMaster()}>
            <GuildMasterPawn size={58} />
        </g>
    </g>
    {#each cogs as cog (cog.playerId)}
        <g transform="translate({cog.position.x} {cog.position.y})">
            <g {@attach gameSession.fleetAnimator.attachCog(cog.playerId)}>
                <CogShip color={gameSession.colors.getPlayerUiColor(cog.playerId)} size={54} />
            </g>
        </g>
    {/each}
</g>
