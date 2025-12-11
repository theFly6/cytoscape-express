// src/app.ts

import express from 'express'
import graphRoutes from './routes/graph'
import cors from 'cors'

const app = express()

app.use((req, res, next) => {
  // 1. 获取请求时间（格式化）
  const now = new Date()
  const requestTime = now.toLocaleString('zh-CN')

  // 2. 获取请求信息
  const { method, originalUrl: url } = req

  // 3. 打印日志（可根据需要调整格式）
  if (!url.startsWith('/.')) {
    //  如果url是以非/.开头则输出信息
      console.log(`[${requestTime}] [${method}] ${url}`)
  }

  // 4. 传递给下一个中间件/路由
  next()
})

app.use(cors()) // 允许跨域请求前端访问
app.use(express.json())

app.use('/api', graphRoutes)

import topologyRoutes from './routes/topology'
app.use('/topology', topologyRoutes)

export default app
