<script lang="ts">
    // Instance-scoped SVG ids, so two of these on one page never resolve each other's defs.
    const uid = $props.id()
    const svgId = (name: string) => `${uid}-${name}`

    let { dim = false }: { dim?: boolean } = $props()
</script>

<span
    class="inline-flex items-center justify-center shrink-0 leading-none"
    style="width: 6em; height: 1.3em; {dim ? 'opacity: 0.35; filter: grayscale(70%);' : ''}"
>
    <svg viewBox="0 0 120 26" class="w-full h-full" aria-hidden="true">
        <defs>
            <linearGradient id={svgId('canal-icon-gradient')} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#8888cc"></stop>
                <stop offset="18%" stop-color="#2222aa"></stop>
                <stop offset="65%" stop-color="#0000a0"></stop>
                <stop offset="100%" stop-color="#000081"></stop>
            </linearGradient>
        </defs>
        <rect
            x="1"
            y="6"
            width="118"
            height="14"
            rx="5"
            fill="url(#{svgId('canal-icon-gradient')})"
            stroke="#000050"
            stroke-width="1"
        ></rect>
    </svg>
</span>
