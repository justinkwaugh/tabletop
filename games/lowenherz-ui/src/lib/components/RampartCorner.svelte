<script lang="ts">
    // A slightly darker, larger corner "tower" block, with a small random tilt for an
    // organic, hand-built look rather than perfectly uniform corners.
    const rotation = (Math.random() * 2 - 1) * 1
</script>

<div
    class="relative z-10 w-[33px] h-[33px] justify-self-center self-center"
    style="background-color: #2e2d2a; transform: rotate({rotation}deg);"
></div>
