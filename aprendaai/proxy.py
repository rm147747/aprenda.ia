"""Simple reverse proxy that serves frontend + proxies API to backend.
No authentication layer - family login in the app handles auth.
"""
import asyncio
import os
from pathlib import Path
from aiohttp import web, ClientSession

BACKEND = "http://127.0.0.1:8000"
STATIC_DIR = Path(__file__).parent / "aprendaai-backend" / "static"

async def proxy_handler(request: web.Request) -> web.StreamResponse:
    """Proxy all /api/* and /healthz requests to the backend."""
    url = f"{BACKEND}{request.path_qs}"
    headers = {k: v for k, v in request.headers.items() 
               if k.lower() not in ('host', 'transfer-encoding')}
    
    body = await request.read()
    
    async with request.app['session'].request(
        request.method, url, headers=headers, data=body,
        allow_redirects=False
    ) as resp:
        response = web.StreamResponse(
            status=resp.status,
            headers={k: v for k, v in resp.headers.items()
                     if k.lower() not in ('transfer-encoding', 'content-encoding')}
        )
        await response.prepare(request)
        async for chunk in resp.content.iter_any():
            await response.write(chunk)
        await response.write_eof()
        return response

async def index_handler(request: web.Request) -> web.Response:
    """Serve index.html for SPA routes."""
    return web.FileResponse(STATIC_DIR / "index.html")

async def on_startup(app: web.Application):
    app['session'] = ClientSession()

async def on_cleanup(app: web.Application):
    await app['session'].close()

app = web.Application()
app.on_startup.append(on_startup)
app.on_cleanup.append(on_cleanup)

# API and healthz routes go to backend
app.router.add_route('*', '/api/{path:.*}', proxy_handler)
app.router.add_route('*', '/healthz', proxy_handler)

# Static assets
if (STATIC_DIR / "assets").exists():
    app.router.add_static('/assets', STATIC_DIR / "assets")

# Serve static files (vite.svg etc)
for f in STATIC_DIR.iterdir():
    if f.is_file() and f.name != "index.html":
        app.router.add_get(f'/{f.name}', lambda req, fp=f: web.FileResponse(fp))

# SPA fallback - all other routes serve index.html
app.router.add_get('/{path:.*}', index_handler)
app.router.add_get('/', index_handler)

if __name__ == '__main__':
    web.run_app(app, host='0.0.0.0', port=3000)
