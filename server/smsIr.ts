export type SmsParameter = { name: string; value: string };
export class SmsIrError extends Error {
  constructor(public code: string, public ambiguous = false) {
    super('ارسال پیامک تأیید نشد. لطفاً دوباره تلاش کنید.');
    this.name = 'SmsIrError';
  }
}
const API = 'https://api.sms.ir/v1';

export function smsIrEnabled(env: Record<string, any>): boolean {
  return env.SMS_PROVIDER === 'smsir' || (!env.SMS_PROVIDER && !!env.SMS_IR_API_KEY);
}
export function smsMobile(value: string): string {
  let number = String(value || '').replace(/[۰-۹]/g, c => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g, c => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[\s()-]/g, '');
  if (number.startsWith('+98')) number = '0' + number.slice(3);
  else if (number.startsWith('0098')) number = '0' + number.slice(4);
  else if (/^9\d{9}$/.test(number)) number = '0' + number;
  if (!/^09\d{9}$/.test(number)) throw new SmsIrError('invalid_mobile');
  return number;
}
function headers(env: Record<string, any>) {
  const key = String(env.SMS_IR_API_KEY || '').trim();
  if (!key) throw new SmsIrError('missing_configuration');
  return { 'X-API-KEY': key, Accept: 'application/json', 'Content-Type': 'application/json' };
}

export async function sendSmsIr(env: Record<string, any>, mobile: string, templateId: number, parameters: SmsParameter[], fetcher: typeof fetch = globalThis.fetch): Promise<number> {
  const recipient = smsMobile(mobile);
  if (!Number.isSafeInteger(templateId) || templateId <= 0 || !parameters.length
    || parameters.some(p => !/^[A-Za-z][A-Za-z0-9_]*$/.test(p.name) || !p.value || p.value.length > 25)
    || new Set(parameters.map(p => p.name)).size !== parameters.length) throw new SmsIrError('invalid_template');
  const auth = headers(env);
  let response: Response;
  try {
    response = await fetcher(API + '/send/verify', {
      method: 'POST', headers: auth, body: JSON.stringify({ mobile: recipient, templateId, parameters }),
      signal: AbortSignal.timeout(10000), redirect: 'error',
    });
  } catch { throw new SmsIrError('network_unknown', true); }
  let data: any;
  try { data = await response.json(); } catch { throw new SmsIrError('response_unknown', true); }
  if (!response.ok || data?.status !== 1) throw new SmsIrError(`provider_${Number.isInteger(data?.status) ? data.status : response.status}`);
  const messageId = Number(data?.data?.messageId);
  if (!Number.isSafeInteger(messageId) || messageId <= 0) throw new SmsIrError('acceptance_unknown', true);
  return messageId;
}

export interface SmsTemplate { id: number; title: string; status: number; parameters: { name: string }[] }
export async function smsIrTemplates(env: Record<string, any>, fetcher: typeof fetch = globalThis.fetch): Promise<SmsTemplate[]> {
  const result: SmsTemplate[] = [];
  for (let page = 1; page <= 10; page++) {
    let response: Response;
    try { response = await fetcher(`${API}/templates?pageNumber=${page}&pageSize=100`, { headers: headers(env), signal: AbortSignal.timeout(10000), redirect: 'error' }); }
    catch { throw new SmsIrError('template_lookup_failed'); }
    let body: any;
    try { body = await response.json(); } catch { throw new SmsIrError('template_lookup_failed'); }
    if (!response.ok || body?.status !== 1 || !Array.isArray(body.data)) throw new SmsIrError('template_lookup_failed');
    result.push(...body.data);
    if (body.data.length < 100) return result;
  }
  throw new SmsIrError('template_list_too_large');
}
