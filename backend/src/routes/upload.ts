import { Hono } from 'hono'
import { success, badRequest } from '../utils/response.js'
import { downloadFile, saveUploadedFile } from '../utils/storage.js'

const app = new Hono()

// POST /upload/image
app.post('/image', async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']

  if (!file || !(file instanceof File)) {
    return badRequest(c, 'file is required')
  }

  const buffer = await file.arrayBuffer()
  const path = await saveUploadedFile(buffer, 'uploads', file.name)
  return success(c, { url: `/${path}`, path })
})

// POST /upload/file
app.post('/file', async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']
  const kind = String(body['kind'] || 'uploads').replace(/[^a-z0-9_-]/gi, '') || 'uploads'

  if (!file || !(file instanceof File)) {
    return badRequest(c, 'file is required')
  }

  const buffer = await file.arrayBuffer()
  const path = await saveUploadedFile(buffer, kind, file.name)
  return success(c, { url: `/${path}`, path })
})

// POST /upload/from-url
app.post('/from-url', async (c) => {
  const body = await c.req.json()
  const url = String(body.url || '').trim()
  const kind = String(body.kind || 'uploads').replace(/[^a-z0-9_-]/gi, '') || 'uploads'
  if (!url) return badRequest(c, 'url is required')
  if (!/^https?:\/\//i.test(url)) return success(c, { url: url.startsWith('/') ? url : `/${url}`, path: url.replace(/^\/+/, '') })

  const path = await downloadFile(url, kind)
  return success(c, { url: `/${path}`, path })
})

export default app
