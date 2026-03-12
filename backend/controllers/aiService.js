const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Gemini: Detect food and estimate nutrition from image ───────────────────
async function analyzeFoodWithGemini(base64Image, mimeType = 'image/jpeg') {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `You are a professional nutritionist and food recognition AI. Analyze this food image and provide a detailed nutritional breakdown.

Respond ONLY with valid JSON in exactly this format (no markdown, no explanation):
{
  "foodName": "Specific food name (e.g., 'Grilled Chicken Breast', 'Caesar Salad')",
  "foodDescription": "Brief appetizing description",
  "confidence": 85,
  "servingSize": "100g",
  "estimatedWeight": 200,
  "mealType": "lunch",
  "nutrition": {
    "calories": 250,
    "protein": 30,
    "carbohydrates": 10,
    "fat": 8,
    "fiber": 2,
    "sugar": 3,
    "sodium": 450,
    "cholesterol": 85,
    "vitamins": {
      "vitaminA": { "amount": 120, "unit": "mcg", "dailyValue": 13 },
      "vitaminC": { "amount": 15, "unit": "mg", "dailyValue": 17 },
      "vitaminD": { "amount": 2, "unit": "mcg", "dailyValue": 10 },
      "vitaminE": { "amount": 1.5, "unit": "mg", "dailyValue": 10 },
      "vitaminK": { "amount": 10, "unit": "mcg", "dailyValue": 8 },
      "vitaminB12": { "amount": 0.8, "unit": "mcg", "dailyValue": 33 },
      "folate": { "amount": 25, "unit": "mcg", "dailyValue": 6 }
    },
    "minerals": {
      "calcium": { "amount": 30, "unit": "mg", "dailyValue": 2 },
      "iron": { "amount": 1.5, "unit": "mg", "dailyValue": 8 },
      "magnesium": { "amount": 35, "unit": "mg", "dailyValue": 8 },
      "potassium": { "amount": 380, "unit": "mg", "dailyValue": 8 },
      "zinc": { "amount": 2.5, "unit": "mg", "dailyValue": 23 }
    },
    "dailyValues": {
      "calories": 13,
      "protein": 60,
      "carbohydrates": 3,
      "fat": 10,
      "fiber": 7,
      "sugar": null,
      "sodium": 20
    }
  },
  "tags": {
    "isHighProtein": true,
    "isLowCarb": true,
    "isHighFat": false,
    "isJunkFood": false,
    "isVegan": false,
    "isVegetarian": false,
    "isGlutenFree": true
  },
  "healthScore": 78,
  "healthInsights": ["Good source of lean protein", "Low in saturated fat", "Contains essential B vitamins"]
}

Rules for healthScore (0-100):
- 80-100: Excellent (whole foods, vegetables, lean proteins)
- 60-79: Good (balanced meals, moderate processing)
- 40-59: Fair (some processed ingredients, moderate sugar/fat)
- 20-39: Poor (highly processed, high sugar/sodium)
- 0-19: Very Poor (junk food, extremely high calories/fat/sugar)

Rules for tags:
- isHighProtein: protein > 20g per serving
- isLowCarb: carbs < 20g per serving  
- isHighFat: fat > 15g per serving
- isJunkFood: highly processed, high sugar, artificial ingredients

Be realistic and accurate. Base on what you can see in the image.`;

  const imagePart = {
    inlineData: {
      data: base64Image,
      mimeType: mimeType,
    },
  };

  const result = await model.generateContent([prompt, imagePart]);
  const response = await result.response;
  const text = response.text();

  // Clean JSON response (remove any markdown code blocks if present)
  const cleanedText = text.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(cleanedText);
}

// ─── USDA FoodData Central: Search for verified nutrition data ───────────────
async function searchUSDANutrition(foodName) {
  try {
    const searchResponse = await axios.get(
      `https://api.nal.usda.gov/fdc/v1/foods/search`,
      {
        params: {
          query: foodName,
          api_key: process.env.USDA_API_KEY,
          dataType: 'Foundation,SR Legacy',
          pageSize: 1,
        },
        timeout: 5000,
      }
    );

    if (!searchResponse.data.foods || searchResponse.data.foods.length === 0) {
      return null;
    }

    const food = searchResponse.data.foods[0];
    const nutrients = food.foodNutrients;

    const getNutrient = (name) => {
      const n = nutrients.find((item) =>
        item.nutrientName.toLowerCase().includes(name.toLowerCase())
      );
      return n ? Math.round(n.value * 10) / 10 : 0;
    };

    return {
      fdcId: food.fdcId,
      description: food.description,
      dataType: food.dataType,
      nutrition: {
        calories: getNutrient('energy'),
        protein: getNutrient('protein'),
        carbohydrates: getNutrient('carbohydrate'),
        fat: getNutrient('total lipid'),
        fiber: getNutrient('fiber'),
        sugar: getNutrient('sugars'),
        sodium: getNutrient('sodium'),
        cholesterol: getNutrient('cholesterol'),
      },
    };
  } catch (error) {
    console.error('USDA API error:', error.message);
    return null;
  }
}

// ─── Merge Gemini AI data with USDA verified data ────────────────────────────
async function getCompleteNutritionData(base64Image, mimeType) {
  // Step 1: Gemini identifies food and provides full nutrition estimate
  const geminiData = await analyzeFoodWithGemini(base64Image, mimeType);

  let finalData = { ...geminiData, aiSource: 'gemini_estimated' };

  // Step 2: Try USDA for verified macros (optional enhancement)
  if (process.env.USDA_API_KEY && process.env.USDA_API_KEY !== 'your_usda_api_key_here') {
    try {
      const usdaData = await searchUSDANutrition(geminiData.foodName);
      if (usdaData) {
        // Merge: use USDA macros but keep Gemini's vitamins/minerals/tags
        finalData.nutrition.calories = usdaData.nutrition.calories || geminiData.nutrition.calories;
        finalData.nutrition.protein = usdaData.nutrition.protein || geminiData.nutrition.protein;
        finalData.nutrition.carbohydrates = usdaData.nutrition.carbohydrates || geminiData.nutrition.carbohydrates;
        finalData.nutrition.fat = usdaData.nutrition.fat || geminiData.nutrition.fat;
        finalData.nutrition.fiber = usdaData.nutrition.fiber || geminiData.nutrition.fiber;
        finalData.nutrition.sugar = usdaData.nutrition.sugar || geminiData.nutrition.sugar;
        finalData.nutrition.sodium = usdaData.nutrition.sodium || geminiData.nutrition.sodium;
        finalData.aiSource = 'usda';
        finalData.usdaFdcId = usdaData.fdcId;
      }
    } catch (err) {
      console.warn('USDA lookup failed, using Gemini estimates only:', err.message);
    }
  }

  return finalData;
}

module.exports = { analyzeFoodWithGemini, searchUSDANutrition, getCompleteNutritionData };
