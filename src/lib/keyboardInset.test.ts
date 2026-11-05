import { describe, expect, it } from 'vitest'
import { keyboardInset } from './keyboardInset'

describe('keyboardInset', () => {
  it('без visualViewport клавиатуры нет', () => {
    expect(keyboardInset(800, null)).toEqual({ inset: 0 })
    expect(keyboardInset(800, undefined)).toEqual({ inset: 0 })
  })

  it('видимая область совпадает со страницей — клавиатуры нет', () => {
    expect(keyboardInset(800, { height: 800, offsetTop: 0 })).toEqual({ inset: 0 })
  })

  it('Android: видимая область уменьшилась снизу на высоту клавиатуры', () => {
    expect(keyboardInset(800, { height: 480, offsetTop: 0 })).toEqual({ inset: 320, visibleHeight: 480 })
  })

  it('iOS: видимая область ещё и сдвинута вниз — закрыто только то, что ниже неё', () => {
    expect(keyboardInset(800, { height: 450, offsetTop: 100 })).toEqual({ inset: 250, visibleHeight: 450 })
  })

  it('мелкие расхождения и дробные пиксели не считаются клавиатурой', () => {
    expect(keyboardInset(800, { height: 799.5, offsetTop: 0 })).toEqual({ inset: 0 })
    expect(keyboardInset(800, { height: 770, offsetTop: 0 })).toEqual({ inset: 0 })
  })

  it('округляет дробные значения', () => {
    expect(keyboardInset(844, { height: 503.6, offsetTop: 0.2 })).toEqual({ inset: 340, visibleHeight: 504 })
  })
})
