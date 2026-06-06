import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    PUSHER_APP_ID: !!process.env.PUSHER_APP_ID,
    PUSHER_KEY: !!process.env.PUSHER_KEY,
    PUSHER_SECRET: !!process.env.PUSHER_SECRET,
    PUSHER_CLUSTER: !!process.env.PUSHER_CLUSTER,
    NEXT_PUBLIC_PUSHER_KEY: !!process.env.NEXT_PUBLIC_PUSHER_KEY,
    NEXT_PUBLIC_PUSHER_CLUSTER: !!process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
  });
}
