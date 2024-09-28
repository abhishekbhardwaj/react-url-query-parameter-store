import { createQueryParamStore } from 'react-url-query-parameter-store'
import { z } from 'zod'

const schema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().optional(),
})

const { useQueryParams, useQueryParam } = createQueryParamStore(schema)

export { useQueryParams, useQueryParam }
