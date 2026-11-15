import { describe, expect, it, vi } from 'vitest'
import { closedWhileHidden, type RealtimeTransport } from './realtimeConnection'

function transport() {
    const fake: RealtimeTransport = {
        setHandler: vi.fn(),
        addChannel: vi.fn(async () => {}),
        removeChannel: vi.fn(async () => {}),
        connect: vi.fn(async () => {}),
        disconnect: vi.fn()
    }
    return { fake, connect: vi.mocked(fake.connect), disconnect: vi.mocked(fake.disconnect) }
}

describe('closedWhileHidden', () => {
    it('connects only while it is wanted and the tab is visible', async () => {
        const { fake, connect, disconnect } = transport()
        const connection = closedWhileHidden(fake)

        await connection.connect()
        expect(connect).not.toHaveBeenCalled()

        connection.tabVisibilityChanged(true)
        await vi.waitFor(() => expect(connect).toHaveBeenCalledOnce())

        connection.tabVisibilityChanged(false)
        expect(disconnect).toHaveBeenCalled()
    })

    it('stays closed when the tab is shown after a disconnect', async () => {
        const { fake, connect } = transport()
        const connection = closedWhileHidden(fake)
        connection.tabVisibilityChanged(true)
        await connection.connect()
        expect(connect).toHaveBeenCalledOnce()

        connection.disconnect()
        connection.tabVisibilityChanged(false)
        connection.tabVisibilityChanged(true)
        await Promise.resolve()
        expect(connect).toHaveBeenCalledOnce()
    })
})
