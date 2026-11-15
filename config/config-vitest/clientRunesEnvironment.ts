import type { Environment } from 'vitest/environments'

// Svelte's client build queries reduced motion through window.matchMedia as soon as svelte/motion loads,
// and some client modules add window listeners as they load.
const environment: Environment = {
    name: 'client-runes',
    viteEnvironment: 'client',
    setup(global) {
        global.window = global
        global.addEventListener = () => {}
        global.removeEventListener = () => {}
        global.matchMedia = () => ({
            matches: false,
            addEventListener() {},
            removeEventListener() {}
        })
        return {
            teardown() {
                delete global.window
                delete global.addEventListener
                delete global.removeEventListener
                delete global.matchMedia
            }
        }
    }
}
export default environment
