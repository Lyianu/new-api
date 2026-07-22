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
import { useTranslation } from 'react-i18next'

// Hero 产品面板：用真实的设计令牌把控制台"截"给访客看。
// 所有元素与产品同源（同字体、同色板、同圆角），因此不像 mock，
// 像产品本身——这是 Apple 式 hero 的核心：让产品自己说话。

const USAGE_BARS = [
  34, 41, 38, 52, 47, 58, 63, 55, 71, 66, 78, 74, 86, 92,
]

const MODEL_USAGE = [
  { name: 'claude-sonnet-5', share: 46 },
  { name: 'gpt-5', share: 31 },
  { name: 'gemini-2.5-pro', share: 15 },
  { name: 'deepseek-v3', share: 8 },
]

export function ConsolePanel() {
  const { t } = useTranslation()

  return (
    <div className='relative'>
      {/* 面板身后极淡的暖色光晕，给白卡以"悬浮于纸面"的纵深 */}
      <div
        aria-hidden
        className='absolute inset-x-8 top-8 -bottom-8 -z-10 rounded-[2rem] bg-[radial-gradient(60%_60%_at_50%_30%,color-mix(in_oklch,var(--accent-warm)_7%,transparent),transparent_70%)]'
      />

      <div className='border-border/80 bg-card overflow-hidden rounded-2xl border shadow-[0_1px_1px_rgb(0_0_0/0.02),0_8px_16px_-8px_rgb(0_0_0/0.06),0_28px_56px_-24px_rgb(0_0_0/0.1)]'>
        {/* 顶栏 */}
        <div className='border-border/60 flex items-center justify-between border-b px-5 py-3'>
          <div className='flex items-center gap-2.5'>
            <span className='bg-foreground size-4 rounded-[5px]' />
            <span className='text-[13px] font-semibold tracking-tight'>
              RouterBay
            </span>
            <span className='text-muted-foreground/50 text-[13px]'>
              {t('Console')}
            </span>
          </div>
          <span className='border-border/70 bg-background text-muted-foreground rounded-md border px-2.5 py-1 font-mono text-[11px]'>
            sk-rb-••••••••
          </span>
        </div>

        <div className='grid gap-0 md:grid-cols-[1.4fr_1fr]'>
          {/* 左：用量 */}
          <div className='border-border/60 p-5 md:border-r'>
            <div className='flex items-baseline justify-between'>
              <span className='text-muted-foreground text-[12px]'>
                {t('Usage this month')}
              </span>
              <span className='text-muted-foreground/50 text-[11px]'>
                {t('Last 14 days')}
              </span>
            </div>
            <div className='mt-2 flex items-baseline gap-2'>
              <span className='text-[26px] font-semibold tracking-[-0.02em] tabular-nums'>
                8.42B
              </span>
              <span className='text-muted-foreground text-[12px]'>tokens</span>
            </div>
            <div className='mt-4 flex h-20 items-end gap-[5px]'>
              {USAGE_BARS.map((h, i) => (
                <div
                  key={i}
                  className={
                    i === USAGE_BARS.length - 1
                      ? 'bg-accent-warm/70 flex-1 rounded-[3px]'
                      : 'bg-foreground/[0.08] flex-1 rounded-[3px]'
                  }
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>

          {/* 右：模型分布 */}
          <div className='p-5'>
            <span className='text-muted-foreground text-[12px]'>
              {t('By model')}
            </span>
            <div className='mt-3.5 space-y-3'>
              {MODEL_USAGE.map((m) => (
                <div key={m.name}>
                  <div className='flex items-baseline justify-between'>
                    <span className='font-mono text-[12px] tracking-tight'>
                      {m.name}
                    </span>
                    <span className='text-muted-foreground/70 text-[11px] tabular-nums'>
                      {m.share}%
                    </span>
                  </div>
                  <div className='bg-foreground/[0.06] mt-1.5 h-1 overflow-hidden rounded-full'>
                    <div
                      className='bg-foreground/40 h-full rounded-full'
                      style={{ width: `${m.share}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 底栏 */}
        <div className='border-border/60 text-muted-foreground/70 flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3 text-[12px]'>
          <span>
            {t('Balance')}{' '}
            <span className='text-foreground font-medium tabular-nums'>
              ¥12,608.42
            </span>
          </span>
          <span className='inline-flex items-center gap-1.5'>
            <span className='bg-accent-warm size-1.5 rounded-full' />
            {t('All routes first-party')}
          </span>
        </div>
      </div>
    </div>
  )
}
