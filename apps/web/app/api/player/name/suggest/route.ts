import { NextRequest, NextResponse } from "next/server";
import { nameSuggestResponseSchema } from "@odyssey/shared";
import { gameStore } from "@/lib/server/game-store";
import { apiError } from "@/lib/server/http";

export async function GET(req: NextRequest) {
  try {
    const rawCount = req.nextUrl.searchParams.get("count");
    const count = Number(rawCount ?? "5");
    const suggestions = await gameStore.suggestDisplayNames(Number.isFinite(count) ? count : 5);

    return NextResponse.json(nameSuggestResponseSchema.parse({ suggestions }));
  } catch (error) {
    return apiError(error);
  }
}
