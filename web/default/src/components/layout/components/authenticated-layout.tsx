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
import { AnimatedOutlet } from '@/components/page-transition'
import { SkipToMain } from '@/components/skip-to-main'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { LayoutProvider } from '@/context/layout-provider'
import { cn } from '@/lib/utils'

import { AppSidebar } from './app-sidebar'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout(props: AuthenticatedLayoutProps) {
  return (
    <LayoutProvider>
      {/* 控制台无顶栏：Logo 与全局操作收进 sidebar，头部高度归零 */}
      <SidebarProvider
          // 桌面端侧栏固定展开，不读取历史收缩 cookie
          defaultOpen
          className='flex-col'
          style={{ '--app-header-height': '0px' } as React.CSSProperties}
        >
          <SkipToMain />
          {/* 移动端唯一的侧栏入口（桌面端侧栏常驻） */}
          <SidebarTrigger
            variant='outline'
            className='bg-background fixed right-3 bottom-3 z-40 size-10 rounded-full shadow-md md:hidden'
          />
          <div className='flex min-h-0 w-full flex-1'>
            <AppSidebar />
            <SidebarInset
              className={cn(
                '@container/content',
                'h-[calc(100svh-var(--app-header-height,0px))]',
                'min-h-0 overflow-hidden',
                'peer-data-[variant=inset]:h-[calc(100svh-var(--app-header-height,0px)-(var(--spacing)*4))]'
              )}
            >
              {props.children ?? <AnimatedOutlet />}
            </SidebarInset>
          </div>
      </SidebarProvider>
    </LayoutProvider>
  )
}
