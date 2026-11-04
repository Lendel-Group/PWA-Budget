import {
  Baby, Book, Briefcase, Bus, Car, Coffee, Dumbbell, Fuel, Gamepad2, Gift, GraduationCap, HeartPulse,
  House, Landmark, MoreHorizontal, Music, PawPrint, Pill, Plane, PlusCircle, Shirt, ShoppingBag, ShoppingCart,
  Smartphone, Utensils, Wallet, Wrench, Zap, type LucideIcon,
} from 'lucide-react'

/**
 * Явный реестр иконок: не тянем весь пакет lucide в бандл. Ключ хранится в `Category.icon`
 * (`Home` — историческое имя иконки дома), подпись читает скринридер в выборе иконки.
 */
export const REGISTRY: Record<string, { Icon: LucideIcon; label: string }> = {
  ShoppingCart: { Icon: ShoppingCart, label: 'Корзина' },
  ShoppingBag: { Icon: ShoppingBag, label: 'Покупки' },
  Utensils: { Icon: Utensils, label: 'Еда' },
  Coffee: { Icon: Coffee, label: 'Кофе' },
  Bus: { Icon: Bus, label: 'Автобус' },
  Car: { Icon: Car, label: 'Машина' },
  Fuel: { Icon: Fuel, label: 'Топливо' },
  Plane: { Icon: Plane, label: 'Путешествия' },
  Home: { Icon: House, label: 'Дом' },
  Landmark: { Icon: Landmark, label: 'Банк' },
  HeartPulse: { Icon: HeartPulse, label: 'Здоровье' },
  Pill: { Icon: Pill, label: 'Лекарства' },
  Dumbbell: { Icon: Dumbbell, label: 'Спорт' },
  Gamepad2: { Icon: Gamepad2, label: 'Игры' },
  Music: { Icon: Music, label: 'Музыка' },
  Shirt: { Icon: Shirt, label: 'Одежда' },
  Smartphone: { Icon: Smartphone, label: 'Связь' },
  Zap: { Icon: Zap, label: 'Коммунальные услуги' },
  Wrench: { Icon: Wrench, label: 'Ремонт' },
  GraduationCap: { Icon: GraduationCap, label: 'Обучение' },
  Book: { Icon: Book, label: 'Книги' },
  Baby: { Icon: Baby, label: 'Дети' },
  PawPrint: { Icon: PawPrint, label: 'Питомцы' },
  Gift: { Icon: Gift, label: 'Подарки' },
  Briefcase: { Icon: Briefcase, label: 'Работа' },
  Wallet: { Icon: Wallet, label: 'Кошелёк' },
  PlusCircle: { Icon: PlusCircle, label: 'Плюс' },
  MoreHorizontal: { Icon: MoreHorizontal, label: 'Прочее' },
}

/** Иконки для выбора в категориях (порядок как в реестре). */
export const ICON_CHOICES = Object.entries(REGISTRY).map(([name, { label }]) => ({ name, label }))
