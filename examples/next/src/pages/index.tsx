import Console from '@/console'
import { useQueryParams } from '@/store'
import { useEffect } from 'react'

export default function Home() {
  const [params, setParams] = useQueryParams({ search: 'initial', page: '1' })

  useEffect(() => {
    console.log(params)
  }, [params])

  return (
    <div className="grid grid-rows-[auto_1fr_auto] items-center justify-items-center min-h-screen p-8 pb-20 gap-8 sm:p-20 font-sans">
      <h1 className="text-3xl font-bold">Home</h1>
      <Console />

      <div className="flex flex-col gap-4 w-full max-w-md">
        <input
          type="text"
          value={params.search ?? ''}
          onChange={(e) => setParams({ search: e.target.value })}
          placeholder="Search"
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="number"
          value={params.page ?? ''}
          onChange={(e) => setParams({ page: parseInt(e.target.value, 10) })}
          placeholder="Page"
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  )
}
