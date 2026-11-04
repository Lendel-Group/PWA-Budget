import {
  Briefcase, Bus, Circle, Gamepad2, Gift, HeartPulse, House, Landmark, MoreHorizontal,
  PlusCircle, Shirt, ShoppingCart, Smartphone, Utensils, Wallet, type LucideIcon,
} from 'lucide-react'

/** Явный реестр иконок: не тянем весь пакет lucide в бандл. */
const REGISTRY: Record<string, LucideIcon> = {
  Briefcase, Bus, Gamepad2, Gift, HeartPulse, Home: House, Landmark, MoreHorizontal,
  PlusCircle, Shirt, ShoppingCart, Smartphone, Utensils, Wallet,
}

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = REGISTRY[name] ?? Circle
  return <Icon className={className} aria-hidden />
}
