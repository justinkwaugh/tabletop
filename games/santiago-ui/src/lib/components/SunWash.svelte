<script lang="ts">
    import { W, H } from '$lib/utils/boardGeometry.js'
</script>

<div class="sun-wash absolute" aria-hidden="true" style="left: 10px; top: 10px; width: {W}px; height: {H}px"></div>

<style>
    .sun-wash {
        pointer-events: none;
        border-radius: 14px;
        mix-blend-mode: soft-light;
        opacity: 0.7;
        background:
            radial-gradient(
                130% 120% at 4% 0%,
                rgba(255, 246, 210, 1),
                rgba(255, 232, 170, 0.55) 40%,
                rgba(255, 220, 150, 0) 85%
            ),
            linear-gradient(rgba(255, 236, 185, 0.35), rgba(255, 236, 185, 0.35));
    }
</style>
