'use client';
import { useEffect, useState } from 'react';
import { createUserListLifecycle } from '../api/users-api.js';

export function useUserListLifecycle() {
  const [lifecycle] = useState(createUserListLifecycle);
  useEffect(() => () => lifecycle.cancel(), [lifecycle]);
  return lifecycle;
}
