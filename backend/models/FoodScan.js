const mongoose = require('mongoose');

const nutritionSchema = new mongoose.Schema(
  {
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    carbohydrates: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
    fiber: { type: Number, default: 0 },
    sugar: { type: Number, default: 0 },
    sodium: { type: Number, default: 0 },
    cholesterol: { type: Number, default: 0 },
    vitamins: {
      vitaminA: { amount: Number, unit: { type: String, default: 'mcg' }, dailyValue: Number },
      vitaminC: { amount: Number, unit: { type: String, default: 'mg' }, dailyValue: Number },
      vitaminD: { amount: Number, unit: { type: String, default: 'mcg' }, dailyValue: Number },
      vitaminE: { amount: Number, unit: { type: String, default: 'mg' }, dailyValue: Number },
      vitaminK: { amount: Number, unit: { type: String, default: 'mcg' }, dailyValue: Number },
      vitaminB12: { amount: Number, unit: { type: String, default: 'mcg' }, dailyValue: Number },
      folate: { amount: Number, unit: { type: String, default: 'mcg' }, dailyValue: Number },
    },
    minerals: {
      calcium: { amount: Number, unit: { type: String, default: 'mg' }, dailyValue: Number },
      iron: { amount: Number, unit: { type: String, default: 'mg' }, dailyValue: Number },
      magnesium: { amount: Number, unit: { type: String, default: 'mg' }, dailyValue: Number },
      potassium: { amount: Number, unit: { type: String, default: 'mg' }, dailyValue: Number },
      zinc: { amount: Number, unit: { type: String, default: 'mg' }, dailyValue: Number },
    },
    dailyValues: {
      calories: Number,
      protein: Number,
      carbohydrates: Number,
      fat: Number,
      fiber: Number,
      sugar: Number,
      sodium: Number,
    },
    servingSize: { type: String, default: '100g' },
    servingsPerContainer: { type: Number, default: 1 },
  },
  { _id: false }
);

const foodScanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    foodName: {
      type: String,
      required: true,
      trim: true,
    },
    foodDescription: {
      type: String,
      trim: true,
    },
    imageUrl: {
      type: String,
      default: null,
    },
    imageData: {
      type: String, // base64 thumbnail stored for history display
      default: null,
    },
    nutrition: nutritionSchema,
    healthScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
    },
    tags: {
      isHighProtein: { type: Boolean, default: false },
      isLowCarb: { type: Boolean, default: false },
      isHighFat: { type: Boolean, default: false },
      isJunkFood: { type: Boolean, default: false },
      isVegan: { type: Boolean, default: false },
      isVegetarian: { type: Boolean, default: false },
      isGlutenFree: { type: Boolean, default: false },
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 80,
    },
    aiSource: {
      type: String,
      enum: ['gemini', 'usda', 'gemini_estimated'],
      default: 'gemini',
    },
    mealType: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'snack', 'unknown'],
      default: 'unknown',
    },
    quantity: {
      type: Number,
      default: 1,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    scannedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

// Index for efficient daily queries
foodScanSchema.index({ userId: 1, scannedAt: -1 });

// Virtual for formatted date
foodScanSchema.virtual('formattedDate').get(function () {
  return this.scannedAt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
});

module.exports = mongoose.model('FoodScan', foodScanSchema);
