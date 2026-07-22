/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useEffect, useRef } from 'react'

/**
 * 极轻量滚动视差：元素随视口居中程度做 ±strength·100px 内的纵向漂移。
 * rAF 节流；prefers-reduced-motion 时完全不启用。
 * 返回的 ref 挂在独立包装层上，避免与入场动画的 transform 冲突。
 */
export function useParallax<T extends HTMLElement = HTMLDivElement>(
  strength = 0.06
) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    const update = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      const progress = (r.top + r.height / 2 - vh / 2) / vh
      el.style.transform = `translateY(${(-progress * strength * 100).toFixed(1)}px)`
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [strength])

  return ref
}
