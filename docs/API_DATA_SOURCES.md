# 🌍 API-Based Emissions Data Collection

This document provides setup instructions for collecting structured emissions data from professional ESG data providers.

## 📊 Available API Options

### 1. **CDP (Carbon Disclosure Project)** - RECOMMENDED

**Best for**: Comprehensive climate change data directly from companies

- **Data**: Scope 1, 2, 3 emissions; reduction targets; climate risks
- **Coverage**: 23,000+ companies globally
- **Cost**: Free tier available for researchers, paid for commercial use
- **API Docs**: https://www.cdp.net/en/guidance/guidance-for-companies
- **Data Access**: https://data.cdp.net/

**Setup**:

```bash
# 1. Register at https://www.cdp.net/
# 2. Request API access (academic/research tier is free)
# 3. Get API key from your CDP account dashboard
```

**Example Request**:

```javascript
const response = await fetch("https://api.cdp.net/v1/companies/emissions", {
  headers: {
    Authorization: "Bearer YOUR_CDP_API_KEY",
    "Content-Type": "application/json",
  },
  params: {
    year: 2024,
    sector: "Financial Services",
  },
});
```

---

### 2. **Sustainalytics ESG API**

**Best for**: ESG ratings and emissions intensity data

- **Data**: Carbon intensity, ESG scores, controversy data
- **Coverage**: 15,000+ companies
- **Cost**: Enterprise pricing (contact sales)
- **Contact**: https://www.sustainalytics.com/esg-data

**Benefits**:

- High-quality verified data
- ESG risk ratings alongside emissions
- Industry benchmarking

---

### 3. **Bloomberg ESG Data**

**Best for**: Professional-grade financial + ESG data

- **Data**: Emissions (Scope 1/2/3), ESG scores, carbon footprint
- **Coverage**: 120,000+ companies
- **Cost**: Bloomberg Terminal subscription ($2,000+/month)
- **API**: Bloomberg Data License

**Features**:

- Most comprehensive coverage
- Real-time updates
- Integration with financial data

---

### 4. **Refinitiv (LSEG) ESG API**

**Best for**: Financial institutions and large enterprises

- **Data**: ESG scores, emissions data, controversy screening
- **Coverage**: 80%+ of global market cap
- **Cost**: Enterprise licensing
- **Contact**: https://www.lseg.com/en/data-analytics/esg

---

### 5. **FactSet ESG Data**

**Best for**: Investment firms and asset managers

- **Data**: Emissions, ESG ratings, climate risk
- **Coverage**: 30,000+ companies
- **Cost**: Subscription-based
- **API**: FactSet API Suite

---

### 6. **S&P Global Trucost**

**Best for**: Carbon footprint and environmental data

- **Data**: Scope 1/2/3 emissions, carbon pricing risk
- **Coverage**: 15,000+ companies
- **Cost**: Enterprise pricing
- **Contact**: https://www.spglobal.com/esg/trucost

---

### 7. **OpenESG (Free Alternative)**

**Best for**: Budget projects, prototyping

- **Data**: Public ESG disclosures, basic emissions data
- **Coverage**: Limited (major companies only)
- **Cost**: FREE
- **GitHub**: https://github.com/openesg

**Example**:

```bash
npm install openesg
```

```javascript
import { OpenESG } from "openesg";
const client = new OpenESG();
const emissions = await client.getEmissions("Apple Inc", 2024);
```

---

## 🚀 Quick Start: CDP API (Recommended)

### Step 1: Install Dependencies

```bash
npm install axios dotenv
```

### Step 2: Create `.env` File

```
CDP_API_KEY=your_api_key_here
CDP_API_SECRET=your_secret_here
```

### Step 3: Sample Implementation

See `src/cdpApiCollector.js` for full implementation.

---

## 📋 Comparison Matrix

| Provider       | Coverage   | Cost         | Data Quality | API Ease   | Best For        |
| -------------- | ---------- | ------------ | ------------ | ---------- | --------------- |
| **CDP**        | ⭐⭐⭐⭐⭐ | 💰 Free/Paid | ⭐⭐⭐⭐⭐   | ⭐⭐⭐⭐   | Research, SMEs  |
| Bloomberg      | ⭐⭐⭐⭐⭐ | 💰💰💰       | ⭐⭐⭐⭐⭐   | ⭐⭐⭐     | Enterprises     |
| Sustainalytics | ⭐⭐⭐⭐   | 💰💰         | ⭐⭐⭐⭐⭐   | ⭐⭐⭐⭐   | ESG analysts    |
| Refinitiv      | ⭐⭐⭐⭐⭐ | 💰💰💰       | ⭐⭐⭐⭐⭐   | ⭐⭐⭐     | Financial firms |
| FactSet        | ⭐⭐⭐⭐   | 💰💰         | ⭐⭐⭐⭐     | ⭐⭐⭐⭐   | Asset managers  |
| OpenESG        | ⭐⭐       | FREE         | ⭐⭐⭐       | ⭐⭐⭐⭐⭐ | Prototypes      |

---

## 💡 Recommendations

### For Your Project (Financial Exchange Emissions):

**Best Choice**: **CDP API** (Free tier)

- Covers most stock exchanges and listed companies
- Free for academic/research use
- Structured, validated data
- Easy-to-use API

**Alternative**: **OpenESG** (if budget is $0)

- Limited data but free
- Good for prototyping
- Can supplement with web scraping

**Long-term**: **Bloomberg/Refinitiv** (if budget allows)

- Most comprehensive coverage
- Professional-grade data
- Real-time updates

---

## 🔧 Next Steps

1. **Choose your provider** (recommend CDP)
2. **Sign up and get API credentials**
3. **Run the CDP collector script**: `node src/cdpApiCollector.js`
4. **Merge with scraped data** for complete coverage

---

## 📞 Support

- CDP Support: https://www.cdp.net/en/contact
- OpenESG Issues: https://github.com/openesg/issues
- Bloomberg Support: bloomberg.com/professional/support
