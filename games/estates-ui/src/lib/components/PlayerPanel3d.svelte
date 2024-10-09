<script lang="ts">
    import { T, type Props } from '@threlte/core'
    import { HTML } from '@threlte/extras'
    import { Group } from 'three'
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'

    import PlayerInfo from './PlayerInfo.svelte'
    import GlassPanel from './GlassPanel.svelte'
    import RoundedRectangleGeometry from './RoundedRectangleGeometry.svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession

    let { ref = $bindable(), ...others }: Props<typeof Group> = $props()
    let players = $derived.by(() => {
        const turnOrder = gameSession.gameState.turnManager.turnOrder
        return turnOrder.map(
            (playerId) =>
                gameSession.gameState.players.find((player) => player.playerId === playerId)!
        )
    })
</script>

<T.Group bind:ref {...others}>
    {#each players as player, i}
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
