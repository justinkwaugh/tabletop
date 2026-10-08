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

<svg
    class="pointer-events-none {className}"
    width={size}
    height={size}
    viewBox="0 0 30 30"
    xmlns="http://www.w3.org/2000/svg"
>
    <defs>
        <clipPath id="{id}-top"><circle cx="15" cy="14" r="9"></circle></clipPath>
        <clipPath id="{id}-side">
            <path d="M6 14 A9 9 0 0 0 24 14 V16.5 A9 9 0 0 1 6 16.5 Z"></path>
        </clipPath>
        <filter id="{id}-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04 0.55" numOctaves="2" {seed}
            ></feTurbulence>
            <feColorMatrix type="saturate" values="0"></feColorMatrix>
        </filter>
        <clipPath id="{id}-body">
            <circle cx="15" cy="14" r="9"></circle>
            <path d="M6 14 A9 9 0 0 0 24 14 V16.5 A9 9 0 0 1 6 16.5 Z"></path>
        </clipPath>
        <linearGradient id="{id}-edge" x1="6" y1="0" x2="24" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#000" stop-opacity="0"></stop>
            <stop offset="0.25" stop-color="#000" stop-opacity="0.3"></stop>
            <stop offset="0.75" stop-color="#000" stop-opacity="0.3"></stop>
            <stop offset="1" stop-color="#000" stop-opacity="0"></stop>
        </linearGradient>
        <filter id="{id}-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.1"></feGaussianBlur>
        </filter>
        <filter id="{id}-contact" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.45"></feGaussianBlur>
        </filter>
        <radialGradient id="{id}-shoulder" cx="15" cy="14" r="9" gradientUnits="userSpaceOnUse">
            <stop offset="0.86" stop-color="#000" stop-opacity="0"></stop>
            <stop offset="1" stop-color="#000" stop-opacity="0.16"></stop>
        </radialGradient>
        <linearGradient
            id="{id}-sideShade"
            x1="0"
            y1="14"
            x2="0"
            y2="25.5"
            gradientUnits="userSpaceOnUse"
        >
            <stop offset="0" stop-color="#000" stop-opacity="0.25"></stop>
            <stop offset="1" stop-color="#000" stop-opacity="0.5"></stop>
        </linearGradient>
    </defs>

    <g filter="url(#{id}-soft)">
        <ellipse cx="16.1" cy="18" rx="9.2" ry="8.8" fill="#000" opacity="0.3"></ellipse>
    </g>
    <g filter="url(#{id}-contact)">
        <ellipse cx="15.3" cy="17" rx="9" ry="9" fill="#000" opacity="0.45"></ellipse>
    </g>

    <circle cx="15" cy="16.5" r="9" fill={color}></circle>
    <rect
        x="5"
        y="13"
        width="20"
        height="14"
        fill="url(#{id}-sideShade)"
        clip-path="url(#{id}-side)"
    ></rect>

    <circle cx="15" cy="14" r="9" fill={color}></circle>
    <g clip-path="url(#{id}-top)">
        <rect
            x="0"
            y="0"
            width="30"
            height="30"
            filter="url(#{id}-grain)"
            opacity="0.1"
            style="mix-blend-mode: multiply"
            transform="rotate({grainAngle} 15 14)"
        ></rect>
    </g>
    <circle cx="15" cy="14" r="9" fill="url(#{id}-shoulder)"></circle>
    <path
        d="M6 14 A9 9 0 0 0 24 14"
        fill="none"
        stroke="url(#{id}-edge)"
        stroke-width=".6"
        clip-path="url(#{id}-body)"
    ></path>
</svg>
