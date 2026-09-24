import {route} from '@/server/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

export async function GET(request: Request) {
  return route(request);
}

export async function POST(request: Request) {
  return route(request);
}
