import type { CuriosityItem } from '../types'
import { todayStr } from './format'

function scoreItem(item: CuriosityItem, targetMinutes: number, today: string): number {
  let score = item.priority * 20

  if (item.scheduledDate === today) score += 60

  if (item.estimatedMinutes) {
    const diff = Math.abs(item.estimatedMinutes - targetMinutes)
    score -= diff * 0.8
  }

  const ageDays = (Date.now() - new Date(item.createdAt).getTime()) / 86_400_000
  score += Math.min(ageDays * 2, 20)

  return score
}

export function suggestItems(items: CuriosityItem[], availableMinutes: number, limit = 5): CuriosityItem[] {
  const today = todayStr()

  const eligible = items.filter(i =>
    ['inbox', 'refined', 'scheduled'].includes(i.status) &&
    (!i.estimatedMinutes || i.estimatedMinutes <= availableMinutes + 15)
  )

  return eligible
    .map(item => ({ item, score: scoreItem(item, availableMinutes, today) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.item)
}
