import { jsonBody } from '@/lib/route-response';
import { NextResponse } from 'next/server';
import { UserService } from '@coderank/core/services/UserService';
import { authenticateRequest } from '@coderank/core/security/active-actor';

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const division = searchParams.get('division');

    const usersList = await UserService.listUsers({ role, search, status, division, cursor: searchParams.get('cursor'), limit: searchParams.get('limit') || 100 });
    return NextResponse.json(usersList, { headers: { 'X-Next-Cursor': usersList.length === Number(searchParams.get('limit') || 100) ? String(usersList.at(-1).id) : '', 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Fetch users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = await jsonBody(request);
    const result = await UserService.createUser(user, body);
    return NextResponse.json(result);
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = await authenticateRequest(request);
    const body = await jsonBody(request);
    const result = await UserService.updateUser(user, body);
    return NextResponse.json(result);
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const result = await UserService.deleteUser(user, id);
    return NextResponse.json(result);
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
