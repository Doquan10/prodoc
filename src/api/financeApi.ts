import type {
  ResponseModel,
  FinanceToken,
  FinanceAuth,
  FinanceDashboardData,
  CreditListItem,
  CreditDetails,
  Category,
  ExpensesData,
  ExpenseFilter,
  NewExpense,
  EditExpense,
} from '../types/finance'

// Dev'de vite proxy üzerinden gider (vite.config.ts); prod için VITE_FINANCE_API_URL set edilebilir.
const BASE = (import.meta.env.VITE_FINANCE_API_URL as string | undefined) ?? '/finance-api'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

// ── Auth köprüsü ─────────────────────────────
// Store ↔ api arasında döngüsel import olmasın diye store kendini buradan bağlar.
// Tek auth kaynağı useAuthStore'dur; finance ve PLOS istekleri aynı token'ı kullanır.

interface AuthBridge {
  getToken: () => FinanceToken | null
  onTokenRefreshed: (token: FinanceToken) => void
  onAuthExpired: () => void
}

let bridge: AuthBridge = {
  getToken: () => null,
  onTokenRefreshed: () => {},
  onAuthExpired: () => {},
}

export function bindAuth(b: AuthBridge) {
  bridge = b
}

// ── Yardımcılar ──────────────────────────────

/** Backend PascalCase da camelCase da serileştirebilir — anahtarları camelCase'e indirger. */
function camelize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelize)
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k.charAt(0).toLowerCase() + k.slice(1)] = camelize(v)
    }
    return out
  }
  return value
}

/** Token alan adları backend'de farklı olabilir — bilinen varyantları tek şekle indirger. */
function normalizeToken(raw: unknown): FinanceToken | null {
  if (raw === null || typeof raw !== 'object') return null
  const t = raw as Record<string, unknown>
  const accessToken = t.accessToken ?? t.token ?? t.jwtToken
  const refreshToken = t.refreshToken
  if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') return null
  const expiration = t.accessTokenExpiration ?? t.expiration ?? t.expireDate ?? t.expiresAt
  return {
    accessToken,
    refreshToken,
    expiration: typeof expiration === 'string' ? expiration : undefined,
  }
}

async function tryRefresh(refreshToken: string): Promise<FinanceToken | null> {
  try {
    // Hem query hem body olarak gönderilir — [FromQuery] / [FromBody] iki bağlama da çalışsın
    const res = await fetch(
      `${BASE}/api/Login/RefreshToken?refreshToken=${encodeURIComponent(refreshToken)}`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(refreshToken) },
    )
    const json = camelize(await res.json()) as ResponseModel<unknown> | null
    if (!json?.success) return null
    const token = normalizeToken(json.data)
    if (token) bridge.onTokenRefreshed(token)
    return token
  } catch {
    return null
  }
}

interface RequestOptions {
  body?: unknown
  auth?: boolean
  method?: 'POST' | 'GET' | 'PUT' | 'DELETE'
}

// PLOS da artık aynı .NET backend'e gittiği için bu authed request altyapısı
// (JWT + 401 refresh + ResponseModel çözme) plosApi tarafından da kullanılır.
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { body, auth = true, method = 'POST' } = opts

  const doFetch = (accessToken: string | null) =>
    fetch(`${BASE}/${path}`, {
      method,
      headers: {
        ...JSON_HEADERS,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

  let res: Response
  try {
    res = await doFetch(auth ? (bridge.getToken()?.accessToken ?? null) : null)
  } catch {
    throw new Error("API'ye ulaşılamadı — backend çalışıyor mu?")
  }

  // Access token süresi dolduysa bir kez refresh deneyip isteği tekrarla
  if (res.status === 401 && auth) {
    const refreshToken = bridge.getToken()?.refreshToken
    const fresh = refreshToken ? await tryRefresh(refreshToken) : null
    if (!fresh) {
      bridge.onAuthExpired()
      throw new Error('Oturum süresi doldu — lütfen tekrar giriş yap.')
    }
    res = await doFetch(fresh.accessToken)
  }

  // Kimlik geçerli ama bu işlem için yetki yok — refresh'in faydası olmaz
  if (res.status === 403) {
    throw new Error('Bu işlem için yetkiniz yok.')
  }

  const json = camelize(await res.json().catch(() => null)) as ResponseModel<T> | null
  if (!json) throw new Error(`Beklenmeyen API yanıtı (HTTP ${res.status})`)
  if (!json.success) {
    throw new Error(json.errors?.filter(Boolean).join(', ') || json.message || 'İşlem başarısız')
  }
  return json.data
}

// ── Endpoint'ler ─────────────────────────────

export async function loginRequest(identity: string, password: string): Promise<FinanceAuth> {
  // SignIn modelindeki alan adı email mi userName mi bilinmiyor — ikisi de gönderilir,
  // model binder eşleşeni alır, fazlalığı yok sayar.
  const data = await request<{ fullname?: string; token?: unknown }>('api/Login/Login', {
    auth: false,
    body: { email: identity, userName: identity, username: identity, password },
  })
  const token = normalizeToken(data?.token)
  if (!token) throw new Error('Giriş yanıtından token okunamadı.')
  return { fullname: data.fullname ?? identity, token }
}

export function getDashboardRequest(): Promise<FinanceDashboardData> {
  return request<FinanceDashboardData>('api/Dashboard/GetMobileDashboardDetails')
}

export function getCreditsRequest(): Promise<CreditListItem[]> {
  return request<CreditListItem[]>('api/Credit/GetCreditsByUser')
}

export function getCreditDetailsRequest(id: number): Promise<CreditDetails> {
  // id hem query hem body olarak gönderilir — [FromQuery] / [FromBody] iki bağlama da çalışsın
  return request<CreditDetails>(`api/Credit/GetCreditDetails?id=${id}`, { body: id })
}

export function getCategoriesRequest(): Promise<Category[]> {
  return request<Category[]>('api/Category/GetAllCategories', { method: 'GET' })
}

export function getExpensesRequest(filter: ExpenseFilter): Promise<ExpensesData> {
  // Body: { categoryId, day, month, year } — null alanlar filtreye dahil edilmez
  return request<ExpensesData>('api/MonthlyExpense/GetUserExpensesDetails', { body: filter })
}

export function getDashboardExpensesRequest(): Promise<ExpensesData> {
  // Bugünkü harcamalar — GetUserExpensesDetails ile aynı zarf (totalExpense + expensesDayGroup).
  // Backend filter body'si bekliyor; bugünün gün/ay/yıl'ı gönderilir.
  const now = new Date()
  const filter: ExpenseFilter = {
    categoryId: null,
    day: now.getDate(),
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  }
  return request<ExpensesData>('api/MonthlyExpense/GetExpenseForDashboard', { body: filter })
}

export async function addExpenseRequest(payload: NewExpense): Promise<void> {
  // Body: { name, description, amount, categoryId, reduceMyBalance, expenseChannel, expenseDate }
  const ok = await request<boolean>('api/MonthlyExpense/AddExpense', { body: payload })
  if (ok === false) throw new Error('Harcama eklenemedi.')
}

export async function updateExpenseRequest(payload: EditExpense): Promise<void> {
  // Body: AddExpense alanları + id. Backend id'den kaydı yükleyip alanları overwrite eder.
  const ok = await request<boolean>('api/MonthlyExpense/UpdateExpense', { body: payload })
  if (ok === false) throw new Error('Harcama güncellenemedi.')
}

export async function deleteExpenseRequest(id: number): Promise<void> {
  // id hem query hem body olarak gönderilir — [FromQuery] / [FromBody] iki bağlama da çalışsın
  const ok = await request<boolean>(`api/MonthlyExpense/DeleteExpense?id=${id}`, {
    method: 'DELETE',
    body: id,
  })
  if (ok === false) throw new Error('Harcama silinemedi.')
}

export async function payInstallmentRequest(installmentId: number): Promise<void> {
  // Body: PayCreditInstallmentViewModel { Id }
  const ok = await request<boolean>('api/CreditInstallment/PayCreditInstallment', {
    body: { id: installmentId },
  })
  if (ok === false) throw new Error('Ödeme işlemi başarısız oldu.')
}
