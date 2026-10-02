export async function readApiResponse<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : fallback);
  if (data === null) throw new Error(fallback);
  return data as T;
}
