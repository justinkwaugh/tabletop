<script lang="ts">
    /**
     * A cost or threat. Rose is never a bare red shape, so the label is required and the halo is
     * part of the chip; a seal, a game piece, has neither.
     */
    let { label }: { label: string } = $props()

    function required(text: string): string {
        if (!text.trim()) {
            throw new Error('A rose chip needs a label')
        }
        return text
    }
</script>

<span
    class="inline-flex items-center rounded-full bg-feudum-danger-soft px-2 py-0.5 text-xs font-semibold text-feudum-danger ring-2 ring-feudum-halo"
    >{required(label)}</span
>
