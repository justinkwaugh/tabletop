import { createServer } from 'node:http'
import { appendFileSync, readFileSync } from 'node:fs'

const configPath = process.env['BACKEND_FIXTURE_CONFIG']
const config = JSON.parse(readFileSync(configPath, 'utf8'))
const record = (event) =>
    appendFileSync(`${configPath}.events`, JSON.stringify({ event, pid: process.pid }) + '\n')
record('started')
process.on('exit', () => record('exited'))
process.on('disconnect', () => process.exit(1))
if (config.fail) process.exit(1)
if (config.hang) await new Promise(() => {})
await new Promise((resolve) => setTimeout(resolve, config.startupDelay ?? 0))
const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost')
    if (url.pathname === '/reload') process.send('reload')
    if (url.pathname === '/crash') process.exit(1)
    if (url.pathname === '/delay') {
        record('request-started')
        await new Promise((resolve) => setTimeout(resolve, Number(url.searchParams.get('ms'))))
    }
    if (url.pathname === '/stream') {
        response.writeHead(200, { 'content-type': 'text/event-stream' })
        response.write(`data: ${process.pid}\n\n`)
        return
    }
    const body = []
    for await (const chunk of request) body.push(chunk)
    response.setHeader('set-cookie', ['one=1', 'two=2'])
    response.end(
        JSON.stringify({
            pid: process.pid,
            url: request.url,
            method: request.method,
            headers: request.headers,
            body: Buffer.concat(body).toString()
        })
    )
})
process.on('SIGTERM', () => {
    record('draining')
    server.close(() => process.exit(0))
})
server.listen(0, '127.0.0.1', () => {
    record('ready')
    process.send({ port: server.address().port })
})
