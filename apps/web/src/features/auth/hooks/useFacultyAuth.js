'use client';
import { useRoleSession } from './useRoleSession';
export function useFacultyAuth() { return useRoleSession('faculty', '/login'); }
