<script lang="ts">
    import Battlements from '$lib/components/Battlements.svelte'
    import { BoardHeight, BoardWidth } from '$lib/utils/boardGeometry.js'
    import { WallBattlements, WallWalkway } from '$lib/utils/cityWall.js'
</script>

<rect width={BoardWidth} height={BoardHeight} fill={WallWalkway}></rect>
<Battlements paths={WallBattlements} />
