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
import {
  motion,
  useReducedMotion,
  type Transition,
  type Variants,
} from 'motion/react'
import type { ReactNode } from 'react'

import { EASE } from './ease'

// 落地页动画原语。设计取向：克制、精致、有分量——长时长、前快后极缓的
// 缓动，元素"沉降就位"而非"弹出"。所有原语在 prefers-reduced-motion 下
// 退化为直接可见，无位移无模糊。

// 行遮罩揭示：文本行从裁切框下方升入，配合极轻失焦转清晰。
// 用于大标题——每行独立包裹 overflow-hidden，逐行错开。
export function LineReveal({
  children,
  delay = 0,
  className,
  duration = 1,
}: {
  children: ReactNode
  delay?: number
  className?: string
  duration?: number
}) {
  const reduce = useReducedMotion()
  if (reduce) {
    return <span className={className}>{children}</span>
  }
  return (
    <span className={`block overflow-hidden ${className ?? ''}`}>
      <motion.span
        className='block will-change-transform'
        initial={{ y: '110%' }}
        whileInView={{ y: '0%' }}
        viewport={{ once: true, margin: '-12% 0px' }}
        transition={{ duration, ease: EASE, delay }}
      >
        {children}
      </motion.span>
    </span>
  )
}

// 通用进入揭示：上浮 + 淡入 + 轻失焦。用于正文、卡片、次级标题。
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  as = 'div',
  once = true,
}: {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
  as?: 'div' | 'span' | 'section' | 'li'
  once?: boolean
}) {
  const reduce = useReducedMotion()
  const MotionTag = motion[as]
  if (reduce) {
    const Tag = as
    return <Tag className={className}>{children}</Tag>
  }
  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once, margin: '-10% 0px' }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </MotionTag>
  )
}

// 交错容器：子项以 stagger 依次揭示。子项用 <StaggerItem>。
const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}

const staggerChild: Variants = {
  hidden: { opacity: 0, y: 20, filter: 'blur(6px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.8, ease: EASE } as Transition,
  },
}

export function Stagger({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      variants={staggerParent}
      initial='hidden'
      whileInView='show'
      viewport={{ once: true, margin: '-10% 0px' }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div className={className} variants={staggerChild}>
      {children}
    </motion.div>
  )
}
