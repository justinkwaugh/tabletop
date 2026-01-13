<script lang="ts">
    import { T, type Props } from '@threlte/core'
    import { Text, HTML } from '@threlte/extras'
    import { Group, MeshBasicMaterial } from 'three'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'

    import PlayerInfo from './PlayerInfo.svelte'
    import GlassPanel from './GlassPanel.svelte'
    import RoundedRectangleGeometry from './RoundedRectangleGeometry.svelte'
    import { GameSessionMode } from '@tabletop/frontend-components'
    import { isEndAuction } from '@tabletop/estates'
    import type { OnceAroundAuction } from '@tabletop/common'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let gameSession = getGameSession() as EstatesGameSession

    let { ref = $bindable(), ...others }: Props<typeof Group> = $props()
    let players = $derived.by(() => {
        const turnOrder = gameSession.gameState.turnManager.turnOrder
        return turnOrder.map(
            (playerId) =>
                gameSession.gameState.players.find((player) => player.playerId === playerId)!
        )
    })

    let lastAction = $derived(gameSession.currentAction)

    function getBidStringForPlayer(playerId: string): string | undefined {
        let auction: OnceAroundAuction | undefined = gameSession.gameState.auction

        if (!auction && isEndAuction(lastAction)) {
            auction = lastAction.metadata?.auction
        }
        const participants = auction?.participants ?? []

        const participant = participants.find((participant) => participant.playerId === playerId)

        if (auction?.auctioneerId === playerId) {
            return 'Auctioneer'
        }

        if (!participant) {
            return ''
        }
        if (participant.passed) {
            return 'Passed'
        }
        if (participant.bid === undefined) {
            return ''
        }
        return `Bid $${participant.bid.toString()}`
    }
    const material = new MeshBasicMaterial({ toneMapped: false })
</script>

<T.Group bind:ref {...others}>
    {#each players as player, i}
        <Text
            position.x={i * (players.length === 5 ? 5.5 : 6)}
            color="#f9d057"
            position.y={-2}
            depthOffset={-1}
            fontSize={0.8}
            fontWeight="bold"
            anchorX="50%"
            anchorY="50%"
            text={getBidStringForPlayer(player.playerId)}
            characters="1234567890$?"
            {material}
        />
        <HTML position.x={i * (players.length === 5 ? 5.5 : 6)} distanceFactor={15} transform>
            <PlayerInfo playerId={player.playerId} />
        </HTML>
        <GlassPanel
            width={5}
            height={2.5}
            position.x={i * (players.length === 5 ? 5.5 : 6)}
            position.z={-0.05}
        />
        <T.Mesh position.x={i * (players.length === 5 ? 5.5 : 6)} position.z={-0.1}>
            <RoundedRectangleGeometry width={5} height={2.5} radius={0.2} />
            <T.MeshPhysicalMaterial
                roughness={0.7}
                color={'#222222'}
                clearcoat={1}
                clearcoatRoughness={0.33}
            />
        </T.Mesh>
    {/each}
</T.Group>
