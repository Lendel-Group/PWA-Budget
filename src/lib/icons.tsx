import { Circle } from 'lucide-react'
import { REGISTRY } from './iconRegistry'

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = REGISTRY[name]?.Icon ?? Circle
  return <Icon className={className} aria-hidden />
}
