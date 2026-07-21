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
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { LanguageSwitcher } from '@/components/language-switcher'
import { NotificationPopover } from '@/components/notification-popover'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useNotifications } from '@/hooks/use-notifications'
import { useSystemConfig } from '@/hooks/use-system-config'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import { HeaderLogo } from './header-logo'

export interface PublicHeaderProps {
  showThemeSwitch?: boolean
  showLanguageSwitcher?: boolean
  logo?: React.ReactNode
  siteName?: string
  homeUrl?: string
  showAuthButtons?: boolean
  showNotifications?: boolean
  className?: string
}

/**
 * 公开页顶栏（宣传页专用）。
 *
 * 站内导航链接已整体下线：定价/排行榜/关于等公开页不复存在，
 * 顶栏只保留品牌标识、语言/主题切换和「登录 / 进入控制台」入口。
 */
export function PublicHeader(props: PublicHeaderProps) {
  const {
    showThemeSwitch = true,
    showLanguageSwitcher = true,
    logo: customLogo,
    siteName: customSiteName,
    homeUrl = '/',
    showAuthButtons = true,
    showNotifications = true,
  } = props

  const { t } = useTranslation()
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const { auth } = useAuthStore()
  const {
    systemName,
    logo: systemLogo,
    loading,
    logoLoaded,
  } = useSystemConfig()
  const notifications = useNotifications()

  const isAuthenticated = !!auth.user
  const displaySiteName = customSiteName || systemName

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className='pointer-events-none fixed inset-x-0 top-0 z-50'>
      <div
        className={cn(
          'pointer-events-auto mx-auto transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]',
          scrolled ? 'max-w-[52rem] px-3 pt-3' : 'max-w-7xl px-4 pt-0 md:px-6'
        )}
      >
        <nav
          className={cn(
            'flex items-center justify-between transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]',
            scrolled
              ? 'bg-background/80 border-border/60 h-12 rounded-xl border pr-1.5 pl-4 backdrop-blur-md'
              : 'h-16 px-2'
          )}
        >
          {/* Logo */}
          <Link
            to={homeUrl}
            className='group flex shrink-0 items-center gap-2.5'
          >
            <div className='flex size-7 shrink-0 items-center justify-center'>
              {loading && <Skeleton className='size-full rounded-lg' />}
              {!loading &&
                (customLogo ?? (
                  <HeaderLogo
                    src={systemLogo}
                    loading={loading}
                    logoLoaded={logoLoaded}
                    className='size-full rounded-lg object-contain'
                  />
                ))}
            </div>
            <span className='text-sm font-semibold tracking-tight'>
              {loading ? <Skeleton className='h-4 w-16' /> : displaySiteName}
            </span>
          </Link>

          {/* Global actions */}
          <div className='flex items-center gap-0.5'>
            {showLanguageSwitcher && (
              <span className='hidden sm:inline-flex'>
                <LanguageSwitcher />
              </span>
            )}
            {showThemeSwitch && <ThemeSwitch />}
            {showNotifications && (
              <span className='hidden sm:inline-flex'>
                <NotificationPopover
                  open={notifications.popoverOpen}
                  onOpenChange={notifications.setPopoverOpen}
                  unreadCount={notifications.unreadCount}
                  activeTab={notifications.activeTab}
                  onTabChange={notifications.setActiveTab}
                  notice={notifications.notice}
                  announcements={notifications.announcements}
                  loading={notifications.loading}
                />
              </span>
            )}

            {showAuthButtons && (
              <>
                <div className='bg-border/40 mx-1 h-4 w-px' />
                {loading ? (
                  <Skeleton className='h-8 w-20 rounded-lg' />
                ) : (
                  <Button
                    size='sm'
                    className='h-8 rounded-lg px-3.5 text-xs font-medium'
                    onClick={() =>
                      navigate({ to: isAuthenticated ? '/usage' : '/sign-in' })
                    }
                  >
                    {isAuthenticated ? t('Go to Dashboard') : t('Sign in')}
                  </Button>
                )}
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}
