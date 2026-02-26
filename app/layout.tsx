import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'game-devcode-kr',
  description: '2.5D Hack & Slash prototype',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
        {children}
      </body>
    </html>
  )
}
