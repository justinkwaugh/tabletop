import type { Environment } from 'vitest/environments'

// Svelte's client build queries reduced motion through window.matchMedia as soon as svelte/motion loads.
const environment: Environment = {
    name: 'client-runes',
    viteEnvironment: 'client',
    setup(global) {
        global.window = global
        global.matchMedia = () => ({
            matches: false,
            addEventListener() {},
            removeEventListener() {}
        })
        return {
            teardown() {
                delete global.window
                delete global.matchMedia
            }
        }
    }
}
export default environment
