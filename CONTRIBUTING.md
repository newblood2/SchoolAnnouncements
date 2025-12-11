# Contributing to School Announcements

Thank you for your interest in contributing to the School Announcements Display System! This document provides guidelines for contributing.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/Wyattech/SchoolAnnouncements/issues)
2. If not, create a new issue with:
   - Clear, descriptive title
   - Steps to reproduce the bug
   - Expected vs actual behavior
   - Screenshots if applicable
   - Your environment (OS, browser, Docker version)

### Suggesting Features

1. Check existing issues for similar suggestions
2. Create a new issue with:
   - Clear description of the feature
   - Use case/problem it solves
   - Any mockups or examples if applicable

### Pull Requests

1. Fork the repository
2. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes following the code style guidelines below
4. Test your changes locally with Docker
5. Commit with clear, descriptive messages
6. Push to your fork and create a Pull Request

## Code Style Guidelines

### JavaScript
- Use ES6+ syntax
- Use meaningful variable and function names
- Add JSDoc comments for functions
- Keep functions focused and small
- Use `const` by default, `let` when reassignment is needed

### CSS
- Use CSS custom properties (variables) for theming
- Follow BEM-like naming conventions
- Group related styles together
- Comment complex selectors

### HTML
- Use semantic HTML5 elements
- Include appropriate ARIA labels for accessibility
- Keep markup clean and well-indented

## Testing

Before submitting a PR:

1. **Build and run locally:**
   ```bash
   docker-compose up --build
   ```

2. **Test these features:**
   - Main display loads correctly
   - Admin panel functions work
   - Real-time updates via SSE work
   - Emergency alerts function properly

3. **Check for console errors** in browser DevTools

## Development Setup

1. Clone the repository
2. Copy `.env.example` to `.env`
3. Run `docker-compose up --build`
4. Access the admin panel at `http://localhost:8080/admin.html`

## Questions?

Feel free to open an issue for questions or reach out to the maintainers.

---

Thank you for contributing!
