<script lang="ts">
    import { Input, Modal } from 'flowbite-svelte'

    let {
        open = $bindable(),
        oncancel,
        onconfirm
    }: { open: boolean; oncancel?: () => void; onconfirm?: (name: string) => void } = $props()

    let gameName = $state('')

    function cancel() {
        open = false
        oncancel?.()
    }

    function confirm(event: Event) {
        event.preventDefault()
        const trimmedName = gameName.trim()
        if (!trimmedName) {
            return
        }
        open = false
        onconfirm?.(trimmedName)
    }
</script>

<Modal bind:open class="max-w-md">
    <!-- Modal content -->
    <div class="relative p-4 text-center bg-transparent rounded-lg shadow sm:p-5">
        <svg
            class="w-[48px] h-[48px] dark:text-gray-500 mx-auto mb-3"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
        >
            <path
                stroke="currentColor"
                stroke-linecap="round"
                stroke-width="1"
                d="M11 16h2m6.707-9.293-2.414-2.414A1 1 0 0 0 16.586 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7.414a1 1 0 0 0-.293-.707ZM16 20v-6a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v6h8ZM9 4h6v3a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V4Z"
            ></path>
        </svg>
        <p class="mb-4 text-gray-500 dark:text-gray-300">
            This will save your exploration game to your browser storage so you can continue later.<br
            /><br /><span class="text-yellow-300"
                >It will not be available on other devices or browsers.</span
            >
        </p>
        <form class="flex flex-col space-y-6 mb-4" action="/" onsubmit={confirm}>
            <Input
                bind:value={gameName}
                type="text"
                name="gameName"
                placeholder="Enter game name"
                required
            />

            <div class="flex justify-center items-center space-x-4">
                <button
                    onclick={cancel}
                    type="button"
                    class="py-2 px-3 text-sm font-medium text-gray-500 bg-white rounded-lg border border-gray-200 hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-primary-300 hover:text-gray-900 focus:z-10 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:text-white dark:hover:bg-gray-600 dark:focus:ring-gray-600"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    class="py-2 px-3 text-sm font-medium text-center text-white bg-green-600 rounded-lg hover:bg-green-700 focus:ring-4 focus:outline-none focus:ring-green-300 dark:bg-green-700 dark:hover:bg-green-600 dark:focus:ring-green-900"
                >
                    Save
                </button>
            </div>
        </form>
    </div>
</Modal>
