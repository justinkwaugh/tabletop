<script lang="ts">
    let { label }: { label: string } = $props()
</script>

<span class="stamp">{label}</span>

<style>
    .stamp {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-14deg);
        border: 2px solid #b0262e;
        border-radius: 2px;
        padding: 0 5px;
        color: #b0262e;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: var(--stamp-size, 14px);
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        white-space: nowrap;
        opacity: 0.85;
        pointer-events: none;
    }
</style>
