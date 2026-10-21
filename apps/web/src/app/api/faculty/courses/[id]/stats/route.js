import { NextResponse } from "next/server";
import { CourseReportService } from "@coderank/core/services/CourseReportService";
import { authenticateRequest } from '@coderank/core/security/active-actor';
import { routeError } from "@/lib/route-response";
export async function GET(request, { params }) {
  try {
    return NextResponse.json(
      await CourseReportService.marks(
        await authenticateRequest(request),
        (await params).id,
        new URL(request.url).searchParams,
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}
