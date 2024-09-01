<script lang="ts">
    import JSONTree from 'svelte-json-tree'
    let { json } = $props()
</script>

<div class="rounded-lg bg-white space-y-2 text-left ms-2 p-4 h-[calc(100dvh-76px)] overflow-scroll">
    <div style="--json-tree-font-size: 14px;">
        <JSONTree value={json} />
    </div>
</div>
