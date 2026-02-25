import { NextRequest, NextResponse } from "next/server";
import { nameSuggestResponseSchema } from "@odyssey/shared";
import { generateDisplayNameSuggestions } from "@/lib/name-generator";

export function GET(req: NextRequest) {
  const rawCount = req.nextUrl.searchParams.get("count");
  const count = Number(rawCount ?? "5");
  const suggestions = generateDisplayNameSuggestions(Number.isFinite(count) ? count : 5);

  return NextResponse.json(nameSuggestResponseSchema.parse({ suggestions }));
}
