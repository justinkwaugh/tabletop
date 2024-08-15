<script lang="ts">
    import marketTileImg from '$lib/images/tile-market.png'
    import { fadeScale } from '@tabletop/frontend-components'
</script>

<div
    transition:fadeScale={{ baseScale: 0.1, duration: 100 }}
    class="w-[100px] h-[100px] min-w-[100px] min-h-[100px] flex justify-center align-center bg-contain bg-origin-border border-2 border-gray-900"
>
    <img src={marketTileImg} alt="stall" />
</div>
