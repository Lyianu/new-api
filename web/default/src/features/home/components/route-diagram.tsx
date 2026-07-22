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

// 路由示意图：一个 API Key → RouterBay → 各模型官方源头。
// 这是整页唯一的"动"处——细线上缓慢流动的光点（SMIL animateMotion，
// 零 JS），示意请求经我们直达源头，中间没有任何第三方。
// prefers-reduced-motion 时光点隐藏（见 index.css .rb-pulse）。

const MODELS = [
  { name: 'gpt-5', vendor: 'OpenAI', y: 40 },
  { name: 'claude-sonnet-5', vendor: 'Anthropic', y: 100 },
  { name: 'claude-opus-4-8', vendor: 'Anthropic', y: 160 },
  { name: 'gemini-2.5-pro', vendor: 'Google', y: 220 },
  { name: 'deepseek-v3', vendor: 'DeepSeek', y: 280 },
]

const HUB_X = 235
const HUB_Y = 160
const MODEL_X = 342

function fanPath(y: number) {
  // hub 右缘 → 模型行左缘的缓和贝塞尔
  const x0 = HUB_X + 47
  const x1 = MODEL_X - 10
  const mx = (x0 + x1) / 2
  return `M ${x0} ${HUB_Y} C ${mx} ${HUB_Y}, ${mx} ${y}, ${x1} ${y}`
}

const KEY_PATH = `M 118 ${HUB_Y} L ${HUB_X - 47} ${HUB_Y}`

export function RouteDiagram() {
  const { t } = useTranslation()

  return (
    <figure className='w-full select-none'>
      <svg
        viewBox='0 0 520 320'
        className='w-full'
        role='img'
        aria-label={t('One API key routed through RouterBay to official model sources')}
      >
        {/* 连线 */}
        <path
          d={KEY_PATH}
          className='stroke-border'
          strokeWidth='1'
          fill='none'
        />
        {MODELS.map((m) => (
          <path
            key={m.name}
            d={fanPath(m.y)}
            className='stroke-border'
            strokeWidth='1'
            fill='none'
          />
        ))}

        {/* 流动光点：入向一颗，出向每路一颗，节奏错开 */}
        <circle r='2.2' className='rb-pulse fill-accent-warm'>
          <animateMotion
            dur='2.4s'
            repeatCount='indefinite'
            path={KEY_PATH}
          />
        </circle>
        {MODELS.map((m, i) => (
          <circle key={m.name} r='2.2' className='rb-pulse fill-accent-warm'>
            <animateMotion
              dur='3.2s'
              begin={`${i * 0.55}s`}
              repeatCount='indefinite'
              path={fanPath(m.y)}
            />
          </circle>
        ))}

        {/* 左：调用方（一把 Key） */}
        <g>
          <rect
            x='10'
            y={HUB_Y - 22}
            width='108'
            height='44'
            rx='8'
            className='fill-card stroke-border'
            strokeWidth='1'
          />
          <text
            x='64'
            y={HUB_Y - 3}
            textAnchor='middle'
            className='fill-muted-foreground font-mono text-[10px]'
          >
            sk-rb-········
          </text>
          <text
            x='64'
            y={HUB_Y + 14}
            textAnchor='middle'
            className='fill-foreground/70 text-[10.5px]'
          >
            {t('Your application')}
          </text>
        </g>

        {/* 中：RouterBay */}
        <g>
          <rect
            x={HUB_X - 47}
            y={HUB_Y - 20}
            width='94'
            height='40'
            rx='20'
            className='fill-primary'
          />
          <text
            x={HUB_X}
            y={HUB_Y + 4}
            textAnchor='middle'
            className='fill-primary-foreground text-[12px] font-medium'
          >
            RouterBay
          </text>
        </g>

        {/* 右：模型（官方源头） */}
        {MODELS.map((m) => (
          <g key={m.name}>
            <circle
              cx={MODEL_X}
              cy={m.y}
              r='2.5'
              className='fill-accent-warm/80'
            />
            <text
              x={MODEL_X + 12}
              y={m.y + 3.5}
              className='fill-foreground/85 font-mono text-[11px]'
            >
              {m.name}
            </text>
            <text
              x={MODEL_X + 12}
              y={m.y + 17}
              className='fill-muted-foreground/70 text-[9.5px]'
            >
              {m.vendor}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className='text-muted-foreground/60 mt-3 text-center text-xs'>
        {t('One request, straight to the official source — no intermediaries.')}
      </figcaption>
    </figure>
  )
}
