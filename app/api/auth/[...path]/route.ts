import { NextRequest, NextResponse } from 'next/server'

const BACKEND = process.env.BACKEND_URL || 'http://localhost:3001'

async function proxyRequest(req: NextRequest, pathSegments: string[] | undefined) {
  const path = pathSegments && pathSegments.length ? pathSegments.join('/') : ''
  const url = `${BACKEND}/api/auth/${path}`

  const init: RequestInit = {
    method: req.method,
    headers: {} as Record<string, string>,
    credentials: 'include',
    body: undefined,
  }

  req.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'host') return
    ;(init.headers as Record<string, string>)[key] = value
  })

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      init.body = await req.arrayBuffer()
    } catch {
      // ignore
    }
  }

  const res = await fetch(url, init)
  const responseHeaders = new Headers()
  res.headers.forEach((value, key) => {
    if (['transfer-encoding', 'connection', 'keep-alive', 'upgrade', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailers'].includes(key.toLowerCase())) return
    responseHeaders.set(key, value)
  })

  const buffer = await res.arrayBuffer()
  return new NextResponse(Buffer.from(buffer), { status: res.status, headers: responseHeaders })
}

export async function GET(req: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxyRequest(req, params.path)
}

export async function POST(req: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxyRequest(req, params.path)
}

export async function PUT(req: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxyRequest(req, params.path)
}

export async function DELETE(req: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxyRequest(req, params.path)
}

export async function PATCH(req: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxyRequest(req, params.path)
}
