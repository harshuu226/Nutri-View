const express = require('express');
const { protect } = require('../middleware/auth');
const {
  analyzeFood,
  getFoodHistory,
  getFoodScan,
  deleteFoodScan,
  getDailySummary,
  getWeeklyStats,
} = require('../controllers/foodController');

const router = express.Router();

// All routes are protected
router.use(protect);

router.post('/analyze', analyzeFood);
router.get('/history', getFoodHistory);
router.get('/daily-summary', getDailySummary);
router.get('/weekly-stats', getWeeklyStats);
router.get('/:id', getFoodScan);
router.delete('/:id', deleteFoodScan);

module.exports = router;
