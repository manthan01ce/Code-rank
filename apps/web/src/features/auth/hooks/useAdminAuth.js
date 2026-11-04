'use client';
import { useRoleSession } from './useRoleSession';
export function useAdminAuth() { return useRoleSession('admin', '/'); }
