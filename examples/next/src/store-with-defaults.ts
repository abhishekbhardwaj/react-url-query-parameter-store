import { createQueryParamStore } from 'react-url-query-parameter-store'
import { z } from 'zod'

const schema = z.object({
  search: z.string().optional().default('default'),
  page: z.coerce.number().optional().default(1),
})

const { useQueryParams, useQueryParam } = createQueryParamStore(schema)

export { useQueryParams, useQueryParam }
