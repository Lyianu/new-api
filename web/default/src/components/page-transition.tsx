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
import { Outlet } from '@tanstack/react-router'
import type { ReactNode } from 'react'

// 入场动效已整体下线（简约基调：页面/卡片/表格即时呈现）。
// 组件接口保留为纯透传，避免大面积改动调用点；后续可逐步内联移除。

interface PassthroughProps {
  children: ReactNode
  className?: string
}

export function PageTransition(props: PassthroughProps) {
  return <div className={props.className}>{props.children}</div>
}

export function AnimatedOutlet() {
  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <Outlet />
    </div>
  )
}

export function StaggerContainer(props: PassthroughProps) {
  return <div className={props.className}>{props.children}</div>
}

export function StaggerItem(props: PassthroughProps) {
  return <div className={props.className}>{props.children}</div>
}

export function TableStaggerContainer(props: PassthroughProps) {
  return <tbody className={props.className}>{props.children}</tbody>
}

export function TableStaggerRow(props: PassthroughProps) {
  return <tr className={props.className}>{props.children}</tr>
}

export function CardStaggerContainer(props: PassthroughProps) {
  return <div className={props.className}>{props.children}</div>
}

export function CardStaggerItem(props: PassthroughProps) {
  return <div className={props.className}>{props.children}</div>
}

interface FadeInProps extends PassthroughProps {
  delay?: number
}

export function FadeIn(props: FadeInProps) {
  return <div className={props.className}>{props.children}</div>
}
