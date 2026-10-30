import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// `npm run dev:demo`는 팀원 시안(옛 컨셉 화면 + src/lib/demo.ts 가짜 API)을 연다.
// 운영 빌드에서는 MODE가 상수로 접혀 이 분기와 시안 코드가 번들에 들어가지 않는다.
const Root = import.meta.env.MODE === 'demo'
  ? lazy(() => import('./pages/LegacyApp.tsx'))
  : App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Root />
    </Suspense>
  </StrictMode>,
)
