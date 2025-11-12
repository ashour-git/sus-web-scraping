# Contributing to Emissions Data Web Scraping System

Thank you for your interest in contributing to this project! 🎉

## How to Contribute

### Reporting Issues

If you find a bug or have a suggestion:

1. Check if the issue already exists in [GitHub Issues](https://github.com/yourusername/emission_web_scraping/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce (for bugs)
   - Expected vs actual behavior
   - Your environment (Node.js version, OS, etc.)

### Submitting Pull Requests

1. **Fork the repository**

   ```bash
   git clone https://github.com/yourusername/emission_web_scraping.git
   cd emission_web_scraping
   ```

2. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow existing code style
   - Add comments for complex logic
   - Update documentation if needed

4. **Test your changes**

   ```bash
   npm install
   node src/ultrathinkReparse.js  # Or relevant script
   ```

5. **Commit your changes**

   ```bash
   git add .
   git commit -m "feat: add new PDF extraction strategy"
   ```

6. **Push to your fork**

   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a Pull Request**
   - Go to the original repository
   - Click "New Pull Request"
   - Select your fork and branch
   - Describe your changes clearly

## Development Guidelines

### Code Style

- Use **ES Modules** (import/export)
- Follow **async/await** patterns
- Add **JSDoc comments** for functions
- Keep functions **focused and small**
- Use **descriptive variable names**

### Example

```javascript
/**
 * Extract emissions data from PDF text using table pattern
 * @param {string} text - Raw PDF text content
 * @param {string} pdfPath - Path to source PDF file
 * @returns {Array<Object>} Array of emission records
 */
extractFromTables(text, pdfPath) {
  const records = [];
  // Implementation...
  return records;
}
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

Examples:

```
feat: add CDP API integration for verified data
fix: resolve duplicate record issue in deduplication logic
docs: update API setup guide with new endpoints
```

## Areas for Contribution

### 🔧 High Priority

1. **Additional Website Scrapers**
   - Add scrapers for new sustainability report websites
   - Improve existing scraper success rates

2. **Enhanced PDF Parsing**
   - New extraction strategies
   - Better handling of complex table formats
   - Multi-language support

3. **Data Validation**
   - Additional validation rules
   - Cross-reference with external APIs
   - Automated quality checks

### 🎯 Medium Priority

4. **API Integrations**
   - CDP (Carbon Disclosure Project)
   - Bloomberg ESG API
   - SEC EDGAR filings
   - Other emissions databases

5. **Machine Learning**
   - Auto-categorization of emissions
   - Company name normalization
   - Confidence score improvement

6. **Testing**
   - Unit tests for parsers
   - Integration tests for scrapers
   - Test fixtures with sample PDFs

### 💡 Nice to Have

7. **Data Visualization**
   - Interactive dashboards
   - Trend analysis charts
   - Geographic heatmaps

8. **Documentation**
   - Video tutorials
   - Use case examples
   - API documentation

9. **Performance**
   - Parallel processing optimization
   - Memory usage improvements
   - Caching mechanisms

## Testing Your Contributions

### Manual Testing

1. **Test with sample PDFs**

   ```bash
   # Place test PDFs in output/pdfs/
   node src/ultrathinkReparse.js
   ```

2. **Verify output**

   ```bash
   # Check generated CSV
   Import-Csv output/emissions_data.csv | Select-Object -First 10
   ```

3. **Run status report**
   ```bash
   node src/statusReport.js
   ```

### Test Checklist

Before submitting PR:

- [ ] Code runs without errors
- [ ] New features have examples in comments
- [ ] Documentation updated if needed
- [ ] No hardcoded sensitive data
- [ ] Follows existing code style
- [ ] Tested with real-world data

## Questions?

Feel free to:

- Open a [Discussion](https://github.com/yourusername/emission_web_scraping/discussions)
- Comment on existing issues
- Reach out to maintainers

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the issue, not the person
- Help others learn and grow

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for making this project better! 🌱**
