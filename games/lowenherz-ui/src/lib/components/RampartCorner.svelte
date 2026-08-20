<script lang="ts">
    // A corner "fitting" for the rampart frame, using the same octagon-with-inset-
    // yellow design as wall-to-wall junctions (see WallSegment.svelte) - just larger -
    // with a small random tilt for an organic, hand-built look rather than perfectly
    // uniform corners.
    const rotation = (Math.random() * 2 - 1) * 1

    const SIZE = 33
    const OCTAGON_CLIP =
        'polygon(29.3% 0%, 70.7% 0%, 100% 29.3%, 100% 70.7%, 70.7% 100%, 29.3% 100%, 0% 70.7%, 0% 29.3%)'
    const INNER_OCTAGON_SCALE = 0.55
    const INNER_OCTAGON_COLOR = '#d9b44a'
    const INNER_OFFSET = (SIZE * (1 - INNER_OCTAGON_SCALE)) / 2
</script>

<div
    class="relative z-10 justify-self-center self-center"
    style="width: {SIZE}px; height: {SIZE}px; transform: rotate({rotation}deg);"
>
    <div class="absolute inset-0" style="background-color: #2e332e; clip-path: {OCTAGON_CLIP};"></div>
    <div
        class="absolute"
        style="
            top: {INNER_OFFSET}px;
            left: {INNER_OFFSET}px;
            width: {SIZE * INNER_OCTAGON_SCALE}px;
            height: {SIZE * INNER_OCTAGON_SCALE}px;
            background-color: {INNER_OCTAGON_COLOR};
            clip-path: {OCTAGON_CLIP};
        "
    ></div>
</div>
