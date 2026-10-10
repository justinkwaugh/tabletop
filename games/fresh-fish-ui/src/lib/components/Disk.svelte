<script lang="ts">
    let {
        color,
        size = 30,
        class: className = ''
    }: { color: string; size?: number; class?: string } = $props()

    // Each disk gets its own grain pattern and direction, like real cut wood.
    const id = `disk-${Math.random().toString(36).slice(2)}`
    const seed = Math.floor(Math.random() * 1000)
    const grainAngle = Math.floor(Math.random() * 180)
</script>

<!-- Seen flat from above; only the shadow it casts shows its height. -->
<svg
    class="pointer-events-none {className}"
    width={size}
    height={size}
    viewBox="0 0 30 30"
    xmlns="http://www.w3.org/2000/svg"
>
    <defs>
        <clipPath id="{id}-face"><circle cx="15" cy="15" r="9"></circle></clipPath>
        <filter id="{id}-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04 0.55" numOctaves="2" {seed}
            ></feTurbulence>
            <feColorMatrix type="saturate" values="0"></feColorMatrix>
        </filter>
        <filter id="{id}-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.1"></feGaussianBlur>
        </filter>
        <filter id="{id}-contact" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.45"></feGaussianBlur>
        </filter>
    </defs>

    <g filter="url(#{id}-soft)">
        <circle cx="15.8" cy="16.6" r="9" fill="#000" opacity="0.35"></circle>
    </g>
    <g filter="url(#{id}-contact)">
        <circle cx="15.3" cy="15.7" r="9" fill="#000" opacity="0.35"></circle>
    </g>
    <circle cx="15" cy="15" r="9" fill={color}></circle>
    <g clip-path="url(#{id}-face)">
        <rect
            x="0"
            y="0"
            width="30"
            height="30"
            filter="url(#{id}-grain)"
            opacity="0.1"
            style="mix-blend-mode: multiply"
            transform="rotate({grainAngle} 15 15)"
        ></rect>
    </g>
</svg>
