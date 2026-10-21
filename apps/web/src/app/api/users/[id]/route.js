import { NextResponse } from "next/server";
import { UserManagementService as service } from "@coderank/core/services/UserManagementService";
import { authenticateRequest } from '@coderank/core/security/active-actor';
import { routeError, jsonBody } from "@/lib/route-response";
export async function PUT(request, { params }) {
  try {
    const admin = await authenticateRequest(request);
    service.admin(admin);
    return NextResponse.json({
      success: true,
      ...(await service.mutate(
        admin,
        (await params).id,
        "update",
        await jsonBody(request),
      )),
    });
  } catch (error) {
    return routeError(error);
  }
}
export async function DELETE(request, { params }) {
  try {
    return NextResponse.json({
      success: true,
      ...(await service.mutate(
        await authenticateRequest(request),
        (await params).id,
        "deactivate",
      )),
    });
  } catch (error) {
    return routeError(error);
  }
}
