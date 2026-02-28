import { NextResponse } from "next/server";
import { comicSequenceRequestSchema } from "@odyssey/shared";
import { apiError, parseJson, requireSessionToken } from "@/lib/server/http";
import { resolveComicSequence } from "@/lib/server/comic-sequence-repository";

export async function POST(req: Request) {
  try {
    const sessionToken = requireSessionToken(req);
    const body = await parseJson(req, comicSequenceRequestSchema);
    const sequence = await resolveComicSequence({
      ...body,
      sessionToken
    });

    return NextResponse.json(sequence);
  } catch (error) {
    return apiError(error);
  }
}
