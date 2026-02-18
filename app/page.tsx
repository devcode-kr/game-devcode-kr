'use client'

import dynamic from 'next/dynamic'

const GameCanvas = dynamic(() => import('../components/GameCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-screen bg-[#1a1a2e] text-white">
      Loading...
    </div>
  ),
})

export default function Home() {
  return (
    <main className="flex items-center justify-center w-full h-screen bg-black">
      <GameCanvas />
    </main>
  )
}
