<script lang="ts">
    import { mapImage } from '$lib/images/boardImages.js'
    import { MAP_SIZE } from '$lib/utils/boardGeometry.js'

    const map = mapImage()
</script>

<image href={map.src} x="0" y="0" width={MAP_SIZE.width} height={MAP_SIZE.height}></image>
