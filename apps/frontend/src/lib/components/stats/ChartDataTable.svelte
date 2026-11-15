<script lang="ts">
    let { caption, headers, rows }: { caption: string; headers: string[]; rows: string[][] } =
        $props()
</script>

<table class="sr-only">
    <caption>{caption}</caption>
    <thead>
        <tr>
            {#each headers as header (header)}<th>{header}</th>{/each}
        </tr>
    </thead>
    <tbody>
        {#each rows as row, index (index)}
            <tr>
                {#each row as cell, column (column)}<td>{cell}</td>{/each}
            </tr>
        {/each}
    </tbody>
</table>
