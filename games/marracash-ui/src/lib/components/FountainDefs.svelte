<script lang="ts">
    import { FountainRimShadeId, FountainWaterShadeId } from '$lib/utils/fountainShape.js'
</script>

<linearGradient id={FountainRimShadeId} x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f1d6cc"></stop>
    <stop offset="0.5" stop-color="#e6c3b8"></stop>
    <stop offset="1" stop-color="#c9a097"></stop>
</linearGradient>
<radialGradient id={FountainWaterShadeId} cx="50%" cy="50%" r="55%">
    <stop offset="0" stop-color="#a9d6e6"></stop>
    <stop offset="1" stop-color="#5f9fba"></stop>
</radialGradient>
