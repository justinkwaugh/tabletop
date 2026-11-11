<script lang="ts">
    let {
        x,
        y,
        size = 12,
        color = '#f4efe2',
        edge = '#2e4159'
    }: { x: number; y: number; size?: number; color?: string; edge?: string } = $props()

    const h = $derived(size / 2)
    const q = $derived(size / 4)
</script>

<!-- An isometric cube centred on (x, y): lit top, mid left face, shaded right face. -->
<g
    transform="translate({x} {y})"
    class="cube"
    stroke={edge}
    stroke-width="1"
    stroke-linejoin="round"
>
    <path d="M0 {-h} L{h} {-q} L0 0 L{-h} {-q} Z" fill={color}></path>
    <path d="M{-h} {-q} L0 0 L0 {h} L{-h} {q} Z" fill={color}></path>
    <path d="M{-h} {-q} L0 0 L0 {h} L{-h} {q} Z" fill="#000" fill-opacity="0.18" stroke="none"
    ></path>
    <path d="M{h} {-q} L0 0 L0 {h} L{h} {q} Z" fill={color}></path>
    <path d="M{h} {-q} L0 0 L0 {h} L{h} {q} Z" fill="#000" fill-opacity="0.36" stroke="none"></path>
</g>
