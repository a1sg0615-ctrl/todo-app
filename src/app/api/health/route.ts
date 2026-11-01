import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectDB();
    return NextResponse.json({ status: "ok", db: "connected" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ status: "error", db: "disconnected" }, { status: 503 });
  }
}
