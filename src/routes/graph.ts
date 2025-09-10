import express from 'express'
import { elements, style, clusters,  layoutOptions} from '../data/graph'

const router = express.Router()

router.all('/graph', (req, res) => {
  res.json({
    elements,
    style,
    clusters,
    layoutOptions
  })
})

export default router