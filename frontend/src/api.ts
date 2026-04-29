import axios from 'axios'


const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'


export const api = axios.create({
  baseURL: DEFAULT_API_BASE_URL,
})


export function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data
    if (
      responseData &&
      typeof responseData === 'object' &&
      'error' in responseData &&
      typeof responseData.error === 'string'
    ) {
      return responseData.error
    }

    if (!error.response) {
      return 'Unable to reach the backend right now.'
    }
  }

  return fallback
}
