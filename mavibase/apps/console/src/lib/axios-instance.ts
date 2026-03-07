import axios from "axios"

const authUrl = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1/platform`
  : "http://localhost:5000/api/v1/platform"

const dbUrl = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/api`
  : "http://localhost:5000/api"

const axiosInstance = axios.create({
  withCredentials: true,
})

// Module-level context store — set by ProjectProvider on mount.
// This avoids reading localStorage and keeps context in-memory only.
let _projectId: string | undefined
let _teamId: string | undefined

export function setRequestContext(teamId: string, projectId: string) {
  _teamId = teamId
  _projectId = projectId
}

export function clearRequestContext() {
  _teamId = undefined
  _projectId = undefined
}

// Auth namespace — platform API, includes X-Team-Id and X-Project-Id when available
axiosInstance.auth = {
  get: (url: string, config?: any) =>
    axiosInstance.get(`${authUrl}${url}`, {
      ...config,
      headers: {
        ...config?.headers,
        ...(_teamId && { "X-Team-Id": _teamId }),
        ...(_projectId && { "X-Project-Id": _projectId }),
      },
    }),
  post: (url: string, data?: any, config?: any) =>
    axiosInstance.post(`${authUrl}${url}`, data, {
      ...config,
      headers: {
        ...config?.headers,
        ...(_teamId && { "X-Team-Id": _teamId }),
        ...(_projectId && { "X-Project-Id": _projectId }),
      },
    }),
  put: (url: string, data?: any, config?: any) =>
    axiosInstance.put(`${authUrl}${url}`, data, {
      ...config,
      headers: {
        ...config?.headers,
        ...(_teamId && { "X-Team-Id": _teamId }),
        ...(_projectId && { "X-Project-Id": _projectId }),
      },
    }),
  patch: (url: string, data?: any, config?: any) =>
    axiosInstance.patch(`${authUrl}${url}`, data, {
      ...config,
      headers: {
        ...config?.headers,
        ...(_teamId && { "X-Team-Id": _teamId }),
        ...(_projectId && { "X-Project-Id": _projectId }),
      },
    }),
  delete: (url: string, config?: any) =>
    axiosInstance.delete(`${authUrl}${url}`, {
      ...config,
      headers: {
        ...config?.headers,
        ...(_teamId && { "X-Team-Id": _teamId }),
        ...(_projectId && { "X-Project-Id": _projectId }),
      },
    }),
}

// DB namespace — resource API, always injects X-Project-Id and X-Team-Id headers
const withContext = (config?: any): any => ({
  ...config,
  headers: {
    ...config?.headers,
    ...(_projectId && { "X-Project-Id": _projectId }),
    ...(_teamId && { "X-Team-Id": _teamId }),
  },
})

axiosInstance.db = {
  get: (url: string, config?: any) => axiosInstance.get(`${dbUrl}${url}`, withContext(config)),
  post: (url: string, data?: any, config?: any) => axiosInstance.post(`${dbUrl}${url}`, data, withContext(config)),
  put: (url: string, data?: any, config?: any) => axiosInstance.put(`${dbUrl}${url}`, data, withContext(config)),
  patch: (url: string, data?: any, config?: any) => axiosInstance.patch(`${dbUrl}${url}`, data, withContext(config)),
  delete: (url: string, config?: any) => axiosInstance.delete(`${dbUrl}${url}`, withContext(config)),
}

// 401 interceptor with token refresh + queue
let isRefreshing = false
let failedQueue: { resolve: (v: any) => void; reject: (e: any) => void }[] = []

const processQueue = (error: any) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error)
    else prom.resolve(null)
  })
  failedQueue = []
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response: { status } = {} } = error
    const originalRequest = config

    const isAuthEndpoint =
      originalRequest.url.includes("/auth/verify-token") ||
      originalRequest.url.includes("/auth/refresh-token") ||
      originalRequest.url.includes("/auth/login") ||
      originalRequest.url.includes("/auth/register")

    if (isAuthEndpoint) return Promise.reject(error)

    if (status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then(() => axiosInstance(originalRequest))
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      return new Promise((resolve, reject) => {
        axiosInstance.auth
          .post("/auth/refresh-token")
          .then(() => {
            processQueue(null)
            resolve(axiosInstance(originalRequest))
          })
          .catch((err) => {
            processQueue(err)
            localStorage.removeItem("user")
            window.location.href = "/login"
            reject(err)
          })
          .finally(() => {
            isRefreshing = false
          })
      })
    }

    return Promise.reject(error)
  },
)

export default axiosInstance
