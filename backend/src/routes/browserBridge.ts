import { Hono } from 'hono'
import { success } from '../utils/response.js'

const app = new Hono()

let flowBridgeStatus = {
  tokenPresent: false,
  tokenAgeMs: null as number | null,
  capturedAt: null as number | null,
  updatedAt: null as string | null,
}

export function getFlowBridgeStatus() {
  return { ...flowBridgeStatus }
}

app.post('/flow-token', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  flowBridgeStatus = {
    tokenPresent: !!body.token_present,
    tokenAgeMs: typeof body.token_age_ms === 'number' ? body.token_age_ms : null,
    capturedAt: typeof body.captured_at === 'number' ? body.captured_at : null,
    updatedAt: new Date().toISOString(),
  }
  return success(c, flowBridgeStatus)
})

app.get('/flow-status', (c) => success(c, flowBridgeStatus))

export default app
