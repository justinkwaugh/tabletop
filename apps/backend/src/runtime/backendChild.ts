import { fork, type ChildProcess } from 'node:child_process'

export class BackendChild {
    readonly exited: Promise<void>
    readonly ready: Promise<number>
    private readonly child: ChildProcess
    private exitObserved = false
    private requests = 0
    private readonly idleWaiters = new Set<() => void>()

    constructor(entry: URL, startupTimeoutMs: number, onReload: () => void) {
        this.child = fork(entry, [], { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] })
        this.exited = new Promise((resolve) => {
            const exited = () => {
                this.exitObserved = true
                resolve()
            }
            this.child.once('exit', exited)
            this.child.once('error', () => {
                if (!this.child.pid) exited()
            })
        })
        this.ready = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Backend startup timed out'))
                this.child.kill('SIGKILL')
            }, startupTimeoutMs)
            const fail = (error: Error) => {
                clearTimeout(timeout)
                reject(error)
            }
            this.child.on('error', fail)
            this.child.once('exit', (code, signal) => {
                fail(new Error(`Backend exited: code=${code}, signal=${signal}`))
            })
            this.child.on('message', (message: unknown) => {
                if (message === 'reload') {
                    onReload()
                } else if (
                    typeof message === 'object' &&
                    message !== null &&
                    'port' in message &&
                    typeof message.port === 'number' &&
                    Number.isInteger(message.port) &&
                    message.port > 0 &&
                    message.port <= 65535
                ) {
                    clearTimeout(timeout)
                    resolve(message.port)
                }
            })
        })
    }

    retain(): () => void {
        this.requests++
        let released = false
        return () => {
            if (released) return
            released = true
            this.requests--
            if (this.requests === 0) {
                for (const resolve of this.idleWaiters) resolve()
                this.idleWaiters.clear()
            }
        }
    }

    async stop(timeoutMs: number): Promise<void> {
        if (this.exitObserved) return
        const timeout = setTimeout(() => this.child.kill('SIGKILL'), timeoutMs)
        if (this.requests > 0) {
            await Promise.race([
                this.exited,
                new Promise<void>((resolve) => this.idleWaiters.add(resolve))
            ])
        }
        if (!this.exitObserved) this.child.kill('SIGTERM')
        await this.exited
        clearTimeout(timeout)
        this.idleWaiters.clear()
    }
}
