<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import TableControls from './TableControls.svelte'

    // docs/game-ui-layout.md, Full screen: the wrapper exposes full screen only as its dialog
    // becoming modal, and everything outside the modal dialog is unreachable.
    let expanded = $state(false)
    const watchExpansion: Attachment<HTMLElement> = (node) => {
        const dialog = node.closest('dialog')
        if (!dialog) return
        const read = () => {
            expanded = dialog.matches(':modal')
        }
        const observer = new MutationObserver(read)
        observer.observe(dialog, { attributes: true, attributeFilter: ['role', 'open'] })
        read()
        return () => observer.disconnect()
    }
</script>

<div {@attach watchExpansion}>
    {#if expanded}
        <div class="bg-rtr-table">
            <TableControls />
        </div>
    {/if}
</div>
