const FoodScan = require('../models/FoodScan');
const { getCompleteNutritionData } = require('./aiService');

// @desc    Analyze food image
// @route   POST /api/food/analyze
// @access  Private
const analyzeFood = async (req, res, next) => {
  try {
    const { imageData, mimeType, mealType, notes, quantity } = req.body;

    if (!imageData) {
      return res.status(400).json({ success: false, message: 'Image data is required.' });
    }

    // Strip base64 prefix if present
    const base64 = imageData.includes(',') ? imageData.split(',')[1] : imageData;
    const mime = mimeType || 'image/jpeg';

    // Get AI nutrition analysis
    const nutritionData = await getCompleteNutritionData(base64, mime);

    // Create thumbnail (use first 50KB of base64 for storage)
    const thumbnailData = imageData.length > 70000
      ? imageData.substring(0, 70000)
      : imageData;

    // Save to database
    const foodScan = await FoodScan.create({
      userId: req.user._id,
      foodName: nutritionData.foodName,
      foodDescription: nutritionData.foodDescription,
      imageData: thumbnailData,
      nutrition: nutritionData.nutrition,
      healthScore: nutritionData.healthScore,
      tags: nutritionData.tags,
      confidence: nutritionData.confidence,
      aiSource: nutritionData.aiSource,
      mealType: mealType || nutritionData.mealType || 'unknown',
      quantity: quantity || 1,
      notes: notes || '',
      scannedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: 'Food analyzed successfully!',
      data: {
        ...foodScan.toObject(),
        healthInsights: nutritionData.healthInsights || [],
      },
    });
  } catch (error) {
    if (error.message?.includes('JSON')) {
      return res.status(422).json({
        success: false,
        message: 'Could not identify food in image. Please try a clearer photo.',
      });
    }
    next(error);
  }
};

// @desc    Get user's food history
// @route   GET /api/food/history
// @access  Private
const getFoodHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const { startDate, endDate, mealType } = req.query;
    const filter = { userId: req.user._id };

    if (startDate || endDate) {
      filter.scannedAt = {};
      if (startDate) filter.scannedAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.scannedAt.$lte = end;
      }
    }

    if (mealType && mealType !== 'all') {
      filter.mealType = mealType;
    }

    const [scans, total] = await Promise.all([
      FoodScan.find(filter)
        .sort({ scannedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-imageData'),
      FoodScan.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: scans,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single food scan
// @route   GET /api/food/:id
// @access  Private
const getFoodScan = async (req, res, next) => {
  try {
    const scan = await FoodScan.findOne({ _id: req.params.id, userId: req.user._id });

    if (!scan) {
      return res.status(404).json({ success: false, message: 'Food scan not found.' });
    }

    res.json({ success: true, data: scan });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete food scan
// @route   DELETE /api/food/:id
// @access  Private
const deleteFoodScan = async (req, res, next) => {
  try {
    const scan = await FoodScan.findOneAndDelete({ _id: req.params.id, userId: req.user._id });

    if (!scan) {
      return res.status(404).json({ success: false, message: 'Food scan not found.' });
    }

    res.json({ success: true, message: 'Food scan deleted.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get daily nutrition summary
// @route   GET /api/food/daily-summary
// @access  Private
const getDailySummary = async (req, res, next) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    const scans = await FoodScan.find({
      userId: req.user._id,
      scannedAt: { $gte: startOfDay, $lte: endOfDay },
    }).select('foodName nutrition mealType scannedAt healthScore');

    const totals = scans.reduce(
      (acc, scan) => {
        const q = scan.quantity || 1;
        acc.calories += (scan.nutrition?.calories || 0) * q;
        acc.protein += (scan.nutrition?.protein || 0) * q;
        acc.carbohydrates += (scan.nutrition?.carbohydrates || 0) * q;
        acc.fat += (scan.nutrition?.fat || 0) * q;
        acc.fiber += (scan.nutrition?.fiber || 0) * q;
        acc.sugar += (scan.nutrition?.sugar || 0) * q;
        acc.sodium += (scan.nutrition?.sodium || 0) * q;
        return acc;
      },
      { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 }
    );

    // Round all values
    Object.keys(totals).forEach((k) => {
      totals[k] = Math.round(totals[k] * 10) / 10;
    });

    res.json({
      success: true,
      data: {
        date: startOfDay,
        totals,
        scans,
        totalMeals: scans.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get weekly nutrition chart data
// @route   GET /api/food/weekly-stats
// @access  Private
const getWeeklyStats = async (req, res, next) => {
  try {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    const scans = await FoodScan.find({
      userId: req.user._id,
      scannedAt: { $gte: startDate, $lte: endDate },
    }).select('nutrition scannedAt mealType');

    // Group by day
    const dailyData = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      dailyData[key] = { date: key, calories: 0, protein: 0, carbohydrates: 0, fat: 0, count: 0 };
    }

    scans.forEach((scan) => {
      const key = scan.scannedAt.toISOString().split('T')[0];
      if (dailyData[key]) {
        const q = scan.quantity || 1;
        dailyData[key].calories += (scan.nutrition?.calories || 0) * q;
        dailyData[key].protein += (scan.nutrition?.protein || 0) * q;
        dailyData[key].carbohydrates += (scan.nutrition?.carbohydrates || 0) * q;
        dailyData[key].fat += (scan.nutrition?.fat || 0) * q;
        dailyData[key].count++;
      }
    });

    const chartData = Object.values(dailyData).map((d) => ({
      ...d,
      calories: Math.round(d.calories),
      protein: Math.round(d.protein * 10) / 10,
      carbohydrates: Math.round(d.carbohydrates * 10) / 10,
      fat: Math.round(d.fat * 10) / 10,
    }));

    res.json({ success: true, data: chartData });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  analyzeFood,
  getFoodHistory,
  getFoodScan,
  deleteFoodScan,
  getDailySummary,
  getWeeklyStats,
};
