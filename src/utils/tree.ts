/**
 * id + parentId hiyerarşisinde bir düğümü ve tüm torunlarını toplar.
 * Hem merak kuyruğu (CuriosityItem) hem yazılar (Writing) cascade silmede kullanır —
 * aynı kural mock API'de "sunucu tarafında" da uygulanır (bkz. api/plosApi.ts).
 */
export function collectSubtree(id: string, rows: { id: string; parentId?: string }[]): Set<string> {
  const doomed = new Set([id])
  let grew = true
  while (grew) {
    grew = false
    for (const r of rows) {
      if (r.parentId && doomed.has(r.parentId) && !doomed.has(r.id)) {
        doomed.add(r.id)
        grew = true
      }
    }
  }
  return doomed
}
