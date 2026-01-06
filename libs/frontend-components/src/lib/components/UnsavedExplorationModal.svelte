<script lang="ts">
    import { Modal } from 'flowbite-svelte'

    let {
        open = $bindable(),
        oncancel,
        onconfirm
    }: { open: boolean; oncancel?: () => void; onconfirm?: () => void } = $props()

    function cancel() {
        open = false
        oncancel?.()
    }

    function confirm() {
        open = false
        onconfirm?.()
    }
</script>

<Modal bind:open class="max-w-md">
    <!-- Modal content -->
    <div class="relative p-4 text-center bg-transparent rounded-lg shadow sm:p-5">
        <p class="mb-4 text-gray-500 dark:text-gray-300">
            Your exploration has unsaved changes... continue?
        </p>
        <div class="flex justify-center items-center space-x-4">
            <button
                onclick={cancel}
                type="button"
                class="py-2 px-3 text-sm font-medium text-gray-500 bg-white rounded-lg border border-gray-200 hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-primary-300 hover:text-gray-900 focus:z-10 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:text-white dark:hover:bg-gray-600 dark:focus:ring-gray-600"
            >
                No, cancel
            </button>
            <button
                onclick={confirm}
                type="submit"
                class="py-2 px-3 text-sm font-medium text-center text-white bg-red-600 rounded-lg hover:bg-red-700 focus:ring-4 focus:outline-none focus:ring-red-300 dark:bg-red-700 dark:hover:bg-red-600 dark:focus:ring-red-900"
            >
                Yes, go ahead
            </button>
        </div>
    </div>
</Modal>
