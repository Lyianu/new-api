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

  // 收束：与首屏呼应的大字宣言 + 单一动作。
  return (
    <section className='relative z-10 overflow-hidden px-6 py-32 md:py-44'>
      <div
        aria-hidden
        className='absolute inset-x-0 bottom-0 -z-10 h-[28rem] bg-[radial-gradient(50%_100%_at_50%_100%,color-mix(in_oklch,var(--accent-warm)_4%,transparent),transparent_75%)]'
      />
      <AnimateInView className='mx-auto max-w-3xl text-center'>
        <h2 className='text-[clamp(2rem,5vw,3.5rem)] leading-[1.1] font-semibold tracking-[-0.03em] text-balance'>
          {t('The frontier is one key away.')}
        </h2>
        <p className='text-muted-foreground mx-auto mt-6 max-w-md text-[15px] leading-[1.8] md:text-[16px]'>
          {t('Straight from the source, honestly metered, ready in minutes.')}
        </p>
        <div className='mt-10'>
          <Button
            className='h-12 rounded-full px-8 text-[15px] font-medium shadow-[0_1px_2px_rgb(0_0_0/0.12)] transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_4px_12px_-2px_rgb(0_0_0/0.18)] active:translate-y-0 active:scale-[0.98]'
            render={<Link to='/sign-up' />}
          >
            {t('Get your API key')}
          </Button>
        </div>
      </AnimateInView>
    </section>
  )
}
