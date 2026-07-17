<script lang="ts">
    let { dim = false }: { dim?: boolean } = $props()
</script>

<span
    class="inline-flex items-center justify-center shrink-0 leading-none"
    style="width: 6em; height: 1.3em; {dim ? 'opacity: 0.35; filter: grayscale(70%);' : ''}"
>
    <svg viewBox="0 0 120 26" class="w-full h-full" aria-hidden="true">
        <defs>
            <linearGradient id="canal-icon-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stop-color="#8888cc"/>
                <stop offset="18%"  stop-color="#2222aa"/>
                <stop offset="65%"  stop-color="#0000a0"/>
                <stop offset="100%" stop-color="#000081"/>
            </linearGradient>
        </defs>
        <rect x="1" y="6" width="118" height="14" rx="5" fill="url(#canal-icon-gradient)" stroke="#000050" stroke-width="1" />
    </svg>
</span>
