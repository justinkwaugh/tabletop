import Fastify from 'fastify'
import { appendFileSync } from 'node:fs'
import { tsImport } from 'tsx/esm/api'

const { installHandlerDrain } = await tsImport('../handlerDrain.ts', import.meta.url)
const record = (event) =>
    appendFileSync(
        `${process.env['BACKEND_FIXTURE_CONFIG']}.events`,
        JSON.stringify({ event, pid: process.pid }) + '\n'
    )
const server = Fastify()
installHandlerDrain(server)
record('started')
process.on('exit', () => record('exited'))
process.on('disconnect', () => process.exit(1))
server.get('/', async () => ({ pid: process.pid }))
server.get('/reload', async () => {
    process.send('reload')
    return { pid: process.pid }
})
server.post('/mutation', async (request, reply) => {
    record('mutation-started')
    if (request.query.early) reply.send({ pid: process.pid })
    await new Promise((resolve) => setTimeout(resolve, Number(request.query.ms ?? 600)))
    record('mutation-completed')
    if (request.query.fail) throw new Error('Expected mutation failure')
    return { pid: process.pid }
})
process.on('SIGTERM', async () => {
    record('draining')
    await server.close()
    process.exit(0)
})
await server.listen({ port: 0, host: '127.0.0.1' })
process.send({ port: server.server.address().port })
