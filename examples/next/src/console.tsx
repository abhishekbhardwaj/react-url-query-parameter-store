import React, { useEffect } from 'react'

import { useQueryParams } from './store'

export type ConsoleProps = {}

const Console: React.FC<ConsoleProps> = () => {
  const [params, setParams] = useQueryParams()

  return (
    <div className="flex flex-col items-center gap-4">
      <pre className="font-mono text-sm bg-gray-100 p-4 rounded-lg overflow-auto max-w-full">
        {JSON.stringify(params, null, 2)}
      </pre>
      <button
        onClick={() => setParams({ search: 'test' })}
        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
      >
        Set Search to "test"
      </button>
    </div>
  )
}

export default Console
