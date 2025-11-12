# 🌍 API Data Collection Setup Guide

This guide will help you set up professional API-based emissions data collection to supplement your scraped PDF data.

## 📊 Current Status

- ✅ **ULTRATHINK PDF Scraping**: 3,252 records (97.1% usable quality)
- ⏳ **CDP API Integration**: Ready to implement
- 🎯 **Goal**: 5,000+ records with 90%+ high quality

---

## 🚀 Quick Start

### Option 1: CDP API (Recommended - FREE)

**Why CDP?**

- ✅ Free tier for research/academic use
- ✅ 23,000+ companies globally
- ✅ Verified and validated data
- ✅ Scope 1, 2, 3 emissions
- ✅ Multi-year historical data

**Setup Steps:**

1. **Register for CDP API**

   ```
   Visit: https://www.cdp.net/
   Click: "Request API Access"
   Select: "Research/Academic" tier (FREE)
   ```

2. **Get Your API Key**
   - Check your email for API credentials
   - You'll receive a key like: `cdp_1234567890abcdef`

3. **Create .env File**

   ```bash
   # In your project root (d:\SustainGRC\emission_web_scraping)
   # Create a file named: .env
   # Add this line:
   CDP_API_KEY=your_actual_key_here
   ```

4. **Run the Collector**

   ```bash
   node src/cdpApiCollector.js
   ```

5. **Merge with Existing Data**
   ```bash
   node src/mergeMasterDataset.js
   ```

**Expected Output:**

```
✅ CDP API data: 500-1000 records (varies by company coverage)
✅ ULTRATHINK data: 3,252 records
✅ Master dataset: 3,500-4,000 unique records
✅ Quality: 90%+ high/medium quality
```

---

## 📚 Alternative API Options

### Option 2: OpenESG (FREE - Limited)

**Setup:**

```javascript
// Free tier: 100 requests/month
// Good for testing, limited for production

npm install axios
node src/openESGCollector.js
```

**Pros:**

- Completely free (no registration)
- Easy to start
- Good for testing

**Cons:**

- Limited to 100 requests/month
- Smaller company database
- Less verification

---

### Option 3: Bloomberg ESG API (Paid - $2,000/month)

**For Enterprise Use Only**

Contact: Bloomberg Terminal support

**Pros:**

- Most comprehensive data
- Real-time updates
- Deep financial integration

**Cons:**

- Very expensive ($2,000+/month)
- Requires Bloomberg Terminal
- Overkill for most projects

---

### Option 4: Refinitiv Eikon API (Paid - $1,500/month)

Contact: Refinitiv sales team

**Pros:**

- Strong Middle East coverage
- Integration with stock exchanges
- Good for financial institutions

**Cons:**

- Expensive
- Requires subscription
- Complex setup

---

## 🔧 Manual Setup (No API Key Yet)

If you don't have API credentials yet, you can still prepare:

### 1. Test with Mock Data

```bash
# We'll create a mock API response for testing
node src/createMockApiData.js
node src/mergeMasterDataset.js
```

This will simulate API data so you can test the merger now.

### 2. Merge Current Data

Even without API data, you can create a professional master CSV:

```bash
node src/mergeMasterDataset.js
```

This will:

- Use your existing 3,252 ULTRATHINK records
- Standardize units
- Score quality
- Remove duplicates
- Generate analytics

---

## 📋 Data Quality Tiers

After merging, your data will be scored:

### High Quality (80-100 points)

- ✅ CDP API verified data
- ✅ Complete fields (company, year, scope, value, unit)
- ✅ Third-party verification
- 💡 **Use for:** Official reporting, stakeholder presentations

### Medium Quality (60-79 points)

- ✅ ULTRATHINK high-confidence extractions
- ✅ Most fields complete
- ✅ Context-validated
- 💡 **Use for:** Analysis, trend identification

### Low Quality (0-59 points)

- ⚠️ ULTRATHINK low-confidence extractions
- ⚠️ Some fields inferred
- ⚠️ Limited verification
- 💡 **Use for:** Exploratory analysis only

---

## 🎯 Recommended Workflow

```
1. ✅ DONE: Run ULTRATHINK parser (3,252 records)
   └─ File: emissions_data_ultrathink.csv

2. 📋 TODO: Get CDP API key
   └─ Register at: https://www.cdp.net/

3. 📋 TODO: Run CDP collector
   └─ Command: node src/cdpApiCollector.js
   └─ Expected: 500-1000 verified records

4. 📋 TODO: Merge all data
   └─ Command: node src/mergeMasterDataset.js
   └─ Output: emissions_data_MASTER.csv

5. 📋 TODO: Filter by quality
   └─ High + Medium = 90%+ usable data
```

---

## ❓ Troubleshooting

### "CDP_API_KEY not found"

```bash
# Make sure .env file exists in project root
# File location: d:\SustainGRC\emission_web_scraping\.env
# Content: CDP_API_KEY=your_key_here
```

### "No records collected from API"

- Check API key is valid
- Verify company names match CDP database
- Try with common companies first (Apple, Google, etc.)

### "Merge script finds no files"

```bash
# Make sure these files exist:
# output/emissions_data_ultrathink.csv (already exists)
# output/emissions_data_cdp_api.csv (created after running collector)
```

---

## 📊 Expected Timeline

| Task                 | Time          | Status                 |
| -------------------- | ------------- | ---------------------- |
| Register CDP account | 5 min         | ⏳ Pending             |
| Get API key (email)  | 24-48 hrs     | ⏳ Pending             |
| Run CDP collector    | 5 min         | ⏳ Pending             |
| Merge datasets       | 1 min         | ⏳ Pending             |
| **Total**            | **~2-3 days** | ⏳ Waiting for API key |

---

## 💡 Pro Tips

1. **Start with CDP** - Free tier is perfect for your needs
2. **Test with known companies** - Apple, Google, Microsoft always have data
3. **Use quality scores** - Filter by score ≥60 for reliable analysis
4. **Keep source attribution** - Track where each record came from
5. **Merge regularly** - As you add more API sources, re-run merger

---

## 📞 Support Resources

- **CDP API Docs**: https://api.cdp.net/docs
- **CDP Support**: support@cdp.net
- **OpenESG Docs**: https://www.openesg.com/api
- **Project Issues**: Check console output for specific errors

---

## ✅ Next Steps

1. **Right Now**: Register for CDP API at https://www.cdp.net/
2. **While Waiting**: Review your ULTRATHINK data (emissions_data_ultrathink.csv)
3. **After API Key**: Run collector → Merge → Analyze
4. **Final**: Share emissions_data_MASTER.csv with stakeholders

---

**Questions?** Check the console output - it provides detailed error messages and suggestions.

**Ready to start?** Visit https://www.cdp.net/ and request your FREE research API key! 🚀
