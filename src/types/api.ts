// Ortak API yanıt zarfı — backend'deki .NET ResponseModel<T> konvansiyonunun karşılığı.
// Hem finans API'si (api/financeApi.ts) hem PLOS mock API'si (api/plosApi.ts) bu zarfı kullanır.
// İleride yazılacak PLOS backend'i de tüm endpoint'lerinde bu zarfı dönmelidir.

export interface ResponseModel<T> {
  success: boolean
  count?: number | null
  message: string
  errors?: string[] | null
  data: T
}
