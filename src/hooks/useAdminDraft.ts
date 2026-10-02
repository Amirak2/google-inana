import { useState } from 'react';

// Server refreshes update pristine fields; edited values stay with their record.
export function useAdminDraft<T extends object>(source: T, key = 'settings') {
  const [patches, setPatches] = useState<Record<string, Partial<T>>>({});
  const patch = patches[key] || {};
  const draft = { ...source, ...patch };
  const edit = <K extends keyof T>(field: K, value: T[K] | ((previous: T[K]) => T[K])) => {
    setPatches(previous => {
      const current = { ...source, ...previous[key] };
      const next = typeof value === 'function' ? (value as (previous: T[K]) => T[K])(current[field]) : value;
      return { ...previous, [key]: { ...previous[key], [field]: next } };
    });
  };
  const accept = (snapshot: T) => {
    setPatches(previous => {
      const remaining = { ...previous[key] };
      for (const field of Object.keys(remaining) as (keyof T)[]) {
        if (Object.is(remaining[field], snapshot[field])) delete remaining[field];
      }
      return { ...previous, [key]: remaining };
    });
  };
  return { draft, edit, accept, dirty: Object.keys(patch).length > 0 };
}
