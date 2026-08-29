/**
 * API Helper for Safe Network Requests & Error Handling
 * Prevents "Unexpected token ..., is not valid JSON" errors caused by HTML 404/500 responses.
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status: number;
  isHtmlError?: boolean;
  rawText?: string;
}

/**
 * Validates whether a given URL looks like a valid, configured Supabase URL
 */
export function isValidSupabaseUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('https://') && !trimmed.startsWith('http://')) return false;
  // Exclude default placeholder URLs
  if (
    trimmed.includes('your-project.supabase.co') ||
    trimmed.includes('example.supabase.co') ||
    trimmed.includes('xxx.supabase.co') ||
    trimmed.length < 15
  ) {
    return false;
  }
  return true;
}

/**
 * Validates Supabase anon key format
 */
export function isValidSupabaseKey(key: string | null | undefined): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (
    trimmed.length < 20 ||
    trimmed === 'anon key' ||
    trimmed.includes('your-anon-key') ||
    trimmed.includes('example')
  ) {
    return false;
  }
  return true;
}

/**
 * Converts cryptic JSON parse/HTML errors into human-friendly explanations
 */
export function formatFriendlyErrorMessage(err: any): string {
  if (!err) return 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ';

  const rawMsg = typeof err === 'string' ? err : err.message || JSON.stringify(err);

  // Check for HTML response / invalid JSON token errors
  if (
    rawMsg.includes('Unexpected token') ||
    rawMsg.includes('is not valid JSON') ||
    rawMsg.includes('The page c') ||
    rawMsg.includes('<!DOCTYPE') ||
    rawMsg.includes('<html')
  ) {
    return 'เซิร์ฟเวอร์หรือ Supabase ตอบกลับเป็นหน้าเว็บ HTML (404/500) แทนที่จะเป็นข้อมูล JSON กรุณาตรวจสอบการตั้งค่า Supabase URL แล้วลองใหม่';
  }

  if (rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError') || rawMsg.includes('ERR_CONNECTION')) {
    return 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต';
  }

  if (rawMsg.includes('Invalid login credentials') || rawMsg.includes('invalid_credentials')) {
    return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง';
  }

  if (rawMsg.includes('User already registered') || rawMsg.includes('user_already_exists')) {
    return 'อีเมลนี้ถูกลงทะเบียนไว้แล้ว กรุณาเข้าสู่ระบบ (Log In)';
  }

  if (rawMsg.includes('Password should be at least')) {
    return 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร';
  }

  return rawMsg;
}

/**
 * Performs a fetch request and safely parses JSON without throwing SyntaxError on HTML responses
 */
export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, options);

    if (!res) {
      return {
        success: false,
        error: 'ไม่ได้รับการตอบกลับจากเซิร์ฟเวอร์',
        status: 0
      };
    }

    const status = res.status;
    const contentType = res.headers.get('content-type') || '';

    // Check if the response is actually JSON
    if (contentType.includes('application/json')) {
      try {
        const json = await res.json();
        
        if (!res.ok) {
          return {
            success: false,
            error: json?.error || json?.message || `เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ (รหัสสถานะ ${status})`,
            status,
            data: json
          };
        }

        return {
          success: json.success !== undefined ? Boolean(json.success) : true,
          data: json.data !== undefined ? json.data : json,
          error: json.error,
          status
        };
      } catch (jsonParseErr) {
        return {
          success: false,
          error: 'ไม่สามารถแยกวิเคราะห์ข้อมูล JSON จากเซิร์ฟเวอร์ได้',
          status,
          isHtmlError: false
        };
      }
    } else {
      // Non-JSON response (Likely an HTML 404/500 error page)
      const text = await res.text().catch(() => '');
      const isHtml = text.trim().startsWith('<') || text.includes('<!DOCTYPE') || text.includes('The page');

      let errorMsg = `เซิร์ฟเวอร์ส่งการตอบกลับรูปแบบที่ไม่ถูกต้อง (${status})`;
      if (status === 404) {
        errorMsg = `ไม่พบ Endpoint ที่เรียกใช้งาน (404 Not Found) - เซิร์ฟเวอร์ตอบกลับเป็นหน้าเว็บ`;
      } else if (status >= 500) {
        errorMsg = `เซิร์ฟเวอร์ปลายทางขัดข้อง (${status} Internal Server Error)`;
      } else if (isHtml) {
        errorMsg = `เซิร์ฟเวอร์ตอบกลับเป็นหน้าเว็บ HTML แทนที่จะเป็นข้อมูล JSON`;
      }

      return {
        success: false,
        error: errorMsg,
        status,
        isHtmlError: true,
        rawText: text.substring(0, 200)
      };
    }
  } catch (netErr: any) {
    return {
      success: false,
      error: formatFriendlyErrorMessage(netErr),
      status: 0
    };
  }
}
