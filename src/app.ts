// src/app.ts

import express from 'express'
import graphRoutes from './routes/graph'
import cors from 'cors'

const app = express()

app.use(cors()) // 允许跨域请求前端访问
app.use(express.json())

app.use('/api', graphRoutes)

import topologyRoutes from './routes/topology'
app.use('/topology', topologyRoutes)

export default app
