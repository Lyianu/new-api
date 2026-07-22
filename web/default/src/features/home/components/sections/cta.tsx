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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'

interface CTAProps {
  className?: string
  isAuthenticated?: boolean
}

export function CTA(props: CTAProps) {
  const { t } = useTranslation()

  if (props.isAuthenticated) {
    return null
  }

  // 收束段：一句衬线独白 + 一颗按钮。留白即是姿态。
  return (
    <section className='relative z-10 px-6 pb-28 md:pb-36'>
      <div className='border-border/60 mx-auto max-w-6xl border-t pt-20 md:pt-28'>
        <AnimateInView className='mx-auto max-w-3xl text-center'>
          <h2 className='font-display text-3xl leading-[1.2] font-normal tracking-[-0.01em] text-balance md:text-[2.75rem]'>
            {t('Ready to simplify')} {t('your AI integration?')}
          </h2>
          <p className='text-muted-foreground mx-auto mt-6 max-w-md text-[15px] leading-[1.8]'>
            {t(
              'Deploy your own gateway and start routing requests through your configured upstream services.'
            )}
          </p>
          <div className='mt-10 flex items-center justify-center gap-4'>
            <Button
              className='h-11 rounded-full px-7 text-sm font-medium'
              render={<Link to='/sign-up' />}
            >
              {t('Get Started')}
            </Button>
            <Button
              variant='ghost'
              className='text-muted-foreground hover:text-foreground h-11 rounded-full px-5 text-sm font-medium'
              render={<Link to='/sign-in' />}
            >
              {t('Sign in')}
            </Button>
          </div>
        </AnimateInView>
      </div>
    </section>
  )
}
