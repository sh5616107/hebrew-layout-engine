/** Local browser preview for the Hebrew layout engine. */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { layoutText } from '../src/core/text-layout.js';
import { renderToPDF } from '../src/rendering/pdf-renderer.js';

const engineRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = join(engineRoot, 'app');
const outputDir = join(engineRoot, 'out', 'preview');
const outputPdf = join(outputDir, 'layout-preview.pdf');
const fonts = {
  ezra: join(engineRoot, 'fonts', 'SILEOT.ttf'),
  ezraSr: join(engineRoot, 'fonts', 'SILEOTSR.ttf'),
} as const;

mkdirSync(outputDir, { recursive: true });

function send(response: ServerResponse, status: number, body: string | Buffer, contentType: string): void {
  response.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

async function readRequest(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 500_000) throw new Error('הטקסט ארוך מדי לתצוגה מקדימה אחת.');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function numberInRange(value: unknown, fallback: number, min: number, max: number): number {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) && numberValue >= min && numberValue <= max ? numberValue : fallback;
}

async function serveAsset(response: ServerResponse, name: string): Promise<void> {
  const file = join(appRoot, name);
  const mime = extname(file) === '.css' ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8';
  try {
    send(response, 200, await readFile(file), mime);
  } catch {
    send(response, 404, 'Not found', 'text/plain; charset=utf-8');
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');

  if (request.method === 'GET' && url.pathname === '/') {
    return serveAsset(response, 'index.html');
  }
  if (request.method === 'GET' && (url.pathname === '/app.css' || url.pathname === '/app.js')) {
    return serveAsset(response, url.pathname.slice(1));
  }
  if (request.method === 'GET' && url.pathname === '/preview.pdf') {
    try {
      await stat(outputPdf);
      return send(response, 200, await readFile(outputPdf), 'application/pdf');
    } catch {
      return send(response, 404, 'צור תחילה תצוגה מקדימה.', 'text/plain; charset=utf-8');
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/render') {
    try {
      const body = await readRequest(request) as Record<string, unknown>;
      if (typeof body.text !== 'string' || body.text.trim().length === 0) {
        throw new Error('יש להזין טקסט לעימוד.');
      }
      const fontKey = body.font === 'ezraSr' ? 'ezraSr' : 'ezra';
      const fontSize = numberInRange(body.fontSize, 12, 8, 36);
      const pageWidth = numberInRange(body.pageWidth, 498.9, 200, 1000);
      const pageHeight = numberInRange(body.pageHeight, 708.66, 200, 1400);
      const margin = numberInRange(body.margin, 48, 0, 160);
      const columnGap = numberInRange(body.columnGap, 18, 0, 100);
      const lineHeight = numberInRange(body.lineHeight, 16, 8, 60);

      const layout = layoutText(body.text, {
        fontPath: fonts[fontKey],
        fontSize,
        layout: {
          pageWidth,
          pageHeight,
          leftMargin: margin,
          rightMargin: margin,
          topMargin: margin,
          bottomMargin: margin,
          columnGap,
          lineHeight,
          wordSpacing: fontSize * 0.3,
          justify: { minWordSpace: fontSize * 0.15, maxWordSpace: fontSize * 0.6 },
        },
      });
      await renderToPDF(layout, { fontPath: fonts[fontKey], fontSize, outputPath: outputPdf });
      return send(response, 200, JSON.stringify({ pages: layout.pageCount }), 'application/json; charset=utf-8');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'יצירת ה־PDF נכשלה.';
      return send(response, 400, JSON.stringify({ error: message }), 'application/json; charset=utf-8');
    }
  }
  return send(response, 404, 'Not found', 'text/plain; charset=utf-8');
});

server.listen(4173, '127.0.0.1', () => {
  console.log('תצוגת העימוד מוכנה ב־http://127.0.0.1:4173');
});
