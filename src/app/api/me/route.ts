import { NextResponse } from "next/server";
import { authRoute } from "@/lib/route";
import { getUser } from "@/services/users";

export const GET = authRoute(async (userId) => NextResponse.json(await getUser(userId)));
