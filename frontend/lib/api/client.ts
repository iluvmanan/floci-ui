import axios from "axios"
import { toast } from "sonner"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
})

let isRefreshing = false
let refreshQueue: Array<(token: void) => void> = []

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const status: number | undefined = error.response?.status

    // 401 — attempt token refresh first
    if (status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push(() => resolve(api(original)))
        })
      }
      original._retry = true
      isRefreshing = true
      try {
        await api.post("/auth/refresh")
        refreshQueue.forEach((cb) => cb())
        refreshQueue = []
        return api(original)
      } catch {
        if (typeof window !== "undefined") {
          window.location.href = "/login"
        }
        return Promise.reject(error)
      } finally {
        isRefreshing = false
      }
    }

    // Surface other errors as toasts (skip refresh endpoint & login to avoid loops)
    const url: string = original?.url ?? ""
    const isAuthCall = url.includes("/auth/refresh") || url.includes("/auth/login")
    if (!isAuthCall && status !== undefined && status !== 401) {
      const detail = error.response?.data?.detail
      const message = typeof detail === "string"
        ? detail
        : status === 403
        ? "You don't have permission to perform this action"
        : status >= 500
        ? "Server error — please try again"
        : "Request failed"
      toast.error(message)
    }

    return Promise.reject(error)
  }
)
