<script lang="ts">
    import { T } from '@threlte/core'
    import { HTML } from '@threlte/extras'

    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'

    import PlayerInfo from './PlayerInfo.svelte'
    import GlassPanel from './GlassPanel.svelte'
    import RoundedRectangleGeometry from './RoundedRectangleGeometry.svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession

    let { ...others }: {} = $props()
</script>

<T.Group {...others}>
    {#each gameSession.game.players as player, i}
        <HTML
            position.x={i * (gameSession.game.players.length === 5 ? 5.5 : 6)}
            distanceFactor={15}
            transform
        >
            <PlayerInfo playerId={player.id} />
        </HTML>
        <GlassPanel
            width={5}
            height={2.5}
            position.x={i * (gameSession.game.players.length === 5 ? 5.5 : 6)}
            position.z={-0.05}
        />
        <T.Mesh
            position.x={i * (gameSession.game.players.length === 5 ? 5.5 : 6)}
            position.z={-0.1}
        >
            <RoundedRectangleGeometry width={5} height={2.5} />
            <T.MeshPhysicalMaterial
                roughness={0.7}
                color={'#222222'}
                clearcoat={1}
                clearcoatRoughness={0.33}
            />
        </T.Mesh>
    {/each}
</T.Group>
