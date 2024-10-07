<script lang="ts">
    import { T } from '@threlte/core'
    import { useViewport } from '@threlte/extras'
    import { MachineState } from '@tabletop/estates'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { getContext } from 'svelte'
    import AuctioningHud from './AuctioningHud.svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession

    const viewport = useViewport()
</script>

<T.OrthographicCamera makeDefault zoom={80} position={[0, 0, 10]} />
<T.AmbientLight intensity={1.5} />
<T.PointLight position={[10, 10, 10]} decay={0} intensity={1.5} />

{#if gameSession.gameState.machineState === MachineState.Auctioning}
    <AuctioningHud />
{/if}
